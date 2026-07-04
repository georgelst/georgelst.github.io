const textEncoder = new TextEncoder();

function concatBytes(parts){
  const length = parts.reduce((sum, part)=>sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts){
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function padded(bytes, alignment = 8){
  const padding = (alignment - (bytes.length % alignment)) % alignment;
  return padding ? concatBytes([bytes, new Uint8Array(padding)]) : bytes;
}

function uint32Bytes(values){
  const bytes = new Uint8Array(values.length*4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index)=>view.setUint32(index*4, value >>> 0, true));
  return bytes;
}

function int32Bytes(values){
  const bytes = new Uint8Array(values.length*4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index)=>view.setInt32(index*4, value | 0, true));
  return bytes;
}

function float64Bytes(values){
  const bytes = new Uint8Array(values.length*8);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index)=>view.setFloat64(index*8, Number(value), true));
  return bytes;
}

function uint16Bytes(values){
  const bytes = new Uint8Array(values.length*2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index)=>view.setUint16(index*2, value, true));
  return bytes;
}

const MI_INT8 = 1;
const MI_UINT16 = 4;
const MI_INT32 = 5;
const MI_UINT32 = 6;
const MI_DOUBLE = 9;
const MI_MATRIX = 14;
const MX_STRUCT = 2;
const MX_CHAR = 4;
const MX_DOUBLE = 6;

function dataElement(type, payload){
  return concatBytes([uint32Bytes([type, payload.length]), padded(payload)]);
}

function matlabFieldName(name){
  const clean = String(name).replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z]/, '_');
  return (clean || 'value').slice(0, 63);
}

function numericMatrix(value){
  if (typeof value === 'number' || typeof value === 'boolean'){
    return { dimensions:[1, 1], values:[Number(value)] };
  }
  if (ArrayBuffer.isView(value)){
    return { dimensions:[value.length, 1], values:Array.from(value, Number) };
  }
  if (!Array.isArray(value) || !value.length){
    return { dimensions:[0, 0], values:[] };
  }
  if (!Array.isArray(value[0]) && !ArrayBuffer.isView(value[0])){
    return { dimensions:[value.length, 1], values:value.map(Number) };
  }

  const rows = value.length;
  let columns = 0;
  for (const row of value) columns = Math.max(columns, row?.length || 0);
  const values = [];
  for (let column=0; column<columns; column++){
    for (let row=0; row<rows; row++){
      const item = Number(value[row]?.[column]);
      values.push(Number.isFinite(item) ? item : NaN);
    }
  }
  return { dimensions:[rows, columns], values };
}

function encodeMatrix(name, value){
  const nameElement = dataElement(MI_INT8, textEncoder.encode(name));

  if (typeof value === 'string'){
    const codeUnits = Array.from(value, (character)=>character.charCodeAt(0));
    const payload = concatBytes([
      dataElement(MI_UINT32, uint32Bytes([MX_CHAR, 0])),
      dataElement(MI_INT32, int32Bytes([1, codeUnits.length])),
      nameElement,
      dataElement(MI_UINT16, uint16Bytes(codeUnits))
    ]);
    return dataElement(MI_MATRIX, payload);
  }

  if (value && typeof value === 'object' && !Array.isArray(value) && !ArrayBuffer.isView(value)){
    const entries = Object.entries(value).map(([key, fieldValue])=>[matlabFieldName(key), fieldValue]);
    const fieldLength = Math.max(1, ...entries.map(([key])=>textEncoder.encode(key).length + 1));
    const fieldBytes = new Uint8Array(entries.length*fieldLength);
    entries.forEach(([key], index)=>fieldBytes.set(textEncoder.encode(key).slice(0, fieldLength - 1), index*fieldLength));
    const payloadParts = [
      dataElement(MI_UINT32, uint32Bytes([MX_STRUCT, 0])),
      dataElement(MI_INT32, int32Bytes([1, 1])),
      nameElement,
      dataElement(MI_INT32, int32Bytes([fieldLength])),
      dataElement(MI_INT8, fieldBytes)
    ];
    entries.forEach(([, fieldValue])=>payloadParts.push(encodeMatrix('', fieldValue ?? [])));
    return dataElement(MI_MATRIX, concatBytes(payloadParts));
  }

  const matrix = numericMatrix(value);
  const payload = concatBytes([
    dataElement(MI_UINT32, uint32Bytes([MX_DOUBLE, 0])),
    dataElement(MI_INT32, int32Bytes(matrix.dimensions)),
    nameElement,
    dataElement(MI_DOUBLE, float64Bytes(matrix.values))
  ]);
  return dataElement(MI_MATRIX, payload);
}

export function encodeMatFile(variableName, value){
  const header = new Uint8Array(128);
  header.fill(32, 0, 116);
  const description = textEncoder.encode(`MATLAB 5.0 MAT-file, UNSAERO export, ${new Date().toISOString()}`);
  header.set(description.slice(0, 116), 0);
  header.fill(0, 116, 124);
  const view = new DataView(header.buffer);
  view.setUint16(124, 0x0100, true);
  header[126] = 0x49;
  header[127] = 0x4d;
  return concatBytes([header, encodeMatrix(matlabFieldName(variableName), value)]);
}

function crc32(bytes){
  let crc = 0xffffffff;
  for (const byte of bytes){
    crc ^= byte;
    for (let bit=0; bit<8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateTime(date = new Date()){
  const year = Math.max(1980, date.getFullYear());
  return {
    time:(date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds()/2),
    date:((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function zipHeader(length){
  return new Uint8Array(length);
}

export function createZip(entries){
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = zipDateTime();

  for (const entry of entries){
    const name = textEncoder.encode(entry.name.replace(/\\/g, '/'));
    const data = entry.data instanceof Uint8Array ? entry.data : textEncoder.encode(String(entry.data));
    const crc = crc32(data);
    const local = zipHeader(30);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, stamp.time, true);
    lv.setUint16(12, stamp.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    localParts.push(local, name, data);

    const central = zipHeader(46);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, stamp.time, true);
    cv.setUint16(14, stamp.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = zipHeader(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirectory.length, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);
  return concatBytes([...localParts, centralDirectory, end]);
}

function csvValue(value){
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvText(headers, rows){
  return '\ufeff' + [headers, ...rows].map((row)=>row.map(csvValue).join(';')).join('\r\n') + '\r\n';
}

function columnarTable(value){
  if (!value || typeof value !== 'object' || Array.isArray(value) || ArrayBuffer.isView(value)) return null;
  const entries = Object.entries(value);
  if (!entries.length || !entries.every(([, column])=>Array.isArray(column) || ArrayBuffer.isView(column))) return null;
  if (!entries.every(([, column])=>!column.length || (!Array.isArray(column[0]) && !ArrayBuffer.isView(column[0])))) return null;
  return entries;
}

function columnarRows(entries){
  let length = 0;
  for (const [, column] of entries) length = Math.max(length, column.length || 0);
  const rows = new Array(length);
  for (let row=0; row<length; row++) rows[row] = entries.map(([, column])=>column[row]);
  return rows;
}

export function payloadToCsvEntries(payload){
  const entries = [];
  const walk = (value, path)=>{
    const columns = columnarTable(value);
    if (columns){
      entries.push({
        name:`${path}.csv`,
        data:textEncoder.encode(csvText(columns.map(([name])=>name), columnarRows(columns)))
      });
      return;
    }
    if (Array.isArray(value) || ArrayBuffer.isView(value)){
      const rows = Array.isArray(value[0]) || ArrayBuffer.isView(value[0])
        ? Array.from(value, (row)=>Array.from(row || []))
        : Array.from(value, (item)=>[item]);
      const columns = rows[0]?.map((_, index)=>`column_${index + 1}`) || ['value'];
      entries.push({ name:`${path}.csv`, data:textEncoder.encode(csvText(columns, rows)) });
      return;
    }
    if (!value || typeof value !== 'object') return;

    const scalarRows = [];
    for (const [key, child] of Object.entries(value)){
      if (child === null || ['string', 'number', 'boolean'].includes(typeof child)) scalarRows.push([key, child]);
      else walk(child, path ? `${path}/${key}` : key);
    }
    if (scalarRows.length){
      entries.push({ name:`${path || 'metadata'}.csv`, data:textEncoder.encode(csvText(['key', 'value'], scalarRows)) });
    }
  };
  walk(payload, 'unsaero_case');
  return entries;
}
