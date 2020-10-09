/* eslint-disable no-unused-vars */
import {Utils} from '@natlibfi/melinda-commons';
import {format} from 'util';

const {createLogger} = Utils;
const logger = createLogger(); // eslint-disable-line no-unused-vars

export function collectFromRecord(from, record) {
  logger.log('verbose', `Collecting data from record ${JSON.stringify(from)}`);
  const fields = record.get(new RegExp(`^${from.tag}$`, 'u'));
  logger.log('debug', JSON.stringify(fields));

  // Get non subfield values
  if (from.value === 'value') {
    return fields.map(field => field.value);
  }

  // Get subfield value
  const values = fields.map(field => {
    const [subfield] = field.subfields.filter(sub => sub.code === from.value.code);
    return subfield.value;
  });

  logger.log('debug', JSON.stringify(values));

  return values;
}

export function getFromRecord(from, record) {
  logger.log('verbose', `Getting value from record ${JSON.stringify(from)}`);
  const [field] = record.get(new RegExp(`^${from.tag}$`, 'u'));

  logger.log('debug', JSON.stringify(field));
  // Get non subfield value
  if (from.value === 'value') {
    return field.value;
  }

  // Get subfield value
  const [subfield] = field.subfields.filter(sub => {
    if (sub.code === from.value.code) {
      return true;
    }
    return false;
  });

  return subfield.value;
}

export function addToRecord(value, to, record) {
  logger.log('verbose', 'Adding value to record');
  const [field] = record.get(new RegExp(`^${to.tag}$`, 'u'));
  const formatedValue = format(to.format, value);
  logger.log('debug', formatedValue);

  if (field === undefined) {
    if (to.value === 'value') {
      record.insertField({
        tag: to.tag,
        value: formatedValue
      });

      return record;
    }

    record.insertField({
      tag: to.tag,
      subfields: [
        {
          code: to.value.code,
          value: formatedValue
        }
      ]
    });

    return record;
  }

  if (to.value === 'value') {
    field.value = formatedValue; // eslint-disable-line functional/immutable-data
    return record;
  }

  // Remove old one
  record.removeField(field);
  // Append new one
  record.insertField({
    tag: field.tag,
    ind1: field.ind1,
    ind2: field.ind2,
    subfields: field.subfields.map(sub => {
      if (sub.code === to.value.code) {
        return {code: to.value.code, value: formatedValue};
      }
      return sub;
    })
  });

  // Return record
  return record;
}
