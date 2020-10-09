
import {Utils} from '@natlibfi/melinda-commons';
import {getLinkedInfo} from './finto';
import {eratuontiFactory, HARVESTER_JOB_STATES, COMMON_JOB_STATES, recordActions} from '@natlibfi/melinda-record-link-migration-commons';
import {MarcRecord} from '@natlibfi/marc-record';
import {format} from 'util';
import querystring from 'querystring';
import {by639_1} from 'iso-language-codes'; // eslint-disable-line camelcase

export async function collect(jobId, jobConfig, mongoOperator, eratuontiConfig) {
  const {createLogger} = Utils;
  const logger = createLogger(); // eslint-disable-line no-unused-vars
  const {subfieldsFromRecord} = recordActions();
  const {hostRecord, linkDataHarvestSearch, linkDataHarvesterApiProfileId, linkDataHarvesterValidationFilters} = jobConfig;
  const {apiUrl, apiUsername, apiPassword, apiClientUserAgent} = eratuontiConfig;
  const eratuonti = eratuontiFactory({apiUrl, apiUsername, apiPassword, apiClientUserAgent, linkDataHarvesterApiProfileId});
  const marcRecord = new MarcRecord(hostRecord);
  const changes = linkDataHarvesterValidationFilters.map(filter => filter.changes).flat();
  logger.log('info', JSON.stringify(changes));

  await mongoOperator.setState({jobId, state: HARVESTER_JOB_STATES.PROCESSING_FINTO_HARVESTING});

  logger.log('info', 'Parsing query values');
  const subfields = subfieldsFromRecord(marcRecord, linkDataHarvestSearch);

  if (!subfields) {
    logger.log('debug', 'No values!');
    await mongoOperator.setState({jobId, state: COMMON_JOB_STATES.DONE});
    return;
  }

  logger.log('debug', JSON.stringify(subfields));
  const values = subfields.map(sub => sub.value);
  logger.log('info', 'Generating queries');
  const encodedQuerys = generateEncodedQuerys(values);
  logger.log('info', 'Harvesting link data');
  const linkData = await pump(linkDataHarvestSearch.url, encodedQuerys);

  return sendToEratuonti(hostRecord, changes, linkData);

  async function sendToEratuonti(hostRecord, changes, linkData) {
    // Send records to transformer
    logger.log('info', `Got ${linkData.length} linked data fields from FINTO`);
    try {
      const linkedData = [{record: hostRecord, changes, linkData}];
      logger.log('debug', JSON.stringify(linkedData));

      const response = await eratuonti.sendBlob(linkedData);
      logger.log('silly', JSON.stringify(response));

      logger.log('info', `All Finto data handled. ${response} blob sent to erätuonti!`);
      await mongoOperator.pushBlobIds({jobId, blobIds: [response]});
      await mongoOperator.setState({jobId, state: COMMON_JOB_STATES.DONE});

      return;
    } catch (error) {
      logger.log('error', JSON.stringify(error));
      if (error.status === 400) { // eslint-disable-line functional/no-conditional-statement
        logger.log('error', 'check content-type and import-profile');
        return false;
      }
      return false;
    }
  }

  function generateEncodedQuerys(values) {
    logger.log('silly', JSON.stringify(values));
    const parsedValues = values.map(value => value.substring(value.lastIndexOf('/') + 1));
    logger.log('silly', JSON.stringify(parsedValues));
    const uniqueValues = [...new Set(parsedValues)];
    logger.log('silly', JSON.stringify(uniqueValues));

    const querys = uniqueValues.map(queryValue => ({code: queryValue, query: format(linkDataHarvestSearch.queryFormat, queryValue)}));
    logger.log('silly', JSON.stringify(querys));

    const encodedQuerys = querys.map(({code, query}) => ({code, query: querystring.encode({query})}));
    logger.log('silly', JSON.stringify(encodedQuerys));
    return encodedQuerys;
  }

  async function pump(url, querys, linkData = []) {
    const [query, ...rest] = querys;
    if (query === undefined) {
      return linkData;
    }

    const {code, labels} = await getLinkedInfo(url, query);
    logger.log('verbose', `Handling linked data fields ${JSON.stringify(labels)}`);

    if (labels) {
      logger.log('debug', 'Parse link data');
      const parsedLinkData = await parsePump(code, labels);
      return pump(url, rest, [...linkData, ...parsedLinkData]);
    }

    return pump(url, rest, linkData);
  }

  // [{"label":{"type":"literal","xml:lang":"en","value":"presidents"}},{"label":{"type":"literal","xml:lang":"fi","value":"presidentit"}},{"label":{"type":"literal","xml:lang":"sv","value":"presidenter"}}]
  function parsePump(code, labels, linkData = []) {
    const [current, ...rest] = labels;
    if (current === undefined) {
      return linkData;
    }

    const langToCountry = by639_1[current.label['xml:lang']]; // eslint-disable-line camelcase
    const parserdLinkData = [
      {code: 'a', value: current.label.value},
      {code: '2', value: langToCountry.iso639_2T.toLowerCase()},
      {code: '0', value: code}
    ];

    logger.log('silly', JSON.stringify(parserdLinkData));

    // Filter fields that allready exists

    return parsePump(code, rest, [...linkData, parserdLinkData]);
  }
}
