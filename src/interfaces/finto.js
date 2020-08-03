/* eslint-disable no-unused-vars, */
import {Utils} from '@natlibfi/melinda-commons';
import fetch from 'node-fetch';

// Fetch
// http://api.finto.fi/sparql?query=PREFIX%20skos%3A%20%3Chttp%3A%2F%2Fwww.w3.org%2F2004%2F02%2Fskos%2Fcore%23%3E%0APREFIX%20yso%3A%20%3Chttp%3A%2F%2Fwww.yso.fi%2Fonto%2Fyso%2F%3E%0ASELECT%20DISTINCT%20*%0AFROM%20yso%3A%0AWHERE%20%7B%0A%20%20yso%3Ap1896%20skos%3AprefLabel%20%3Flabel%20.%0A%7D

export async function getLinkedInfo(url, {code, query}) {
  const {createLogger} = Utils;
  const logger = createLogger();

  logger.log('info', 'Executing queries');
  try {
    logger.log('silly', url + query);
    // Execute queries
    const response = await fetch(url + query);
    logger.log('http', response.status);
    const json = await response.json();
    return {code, labels: json.results.bindings};
  } catch (error) {
    logger.log('debug', 'Error while searching link data');
    logger.log('error', error);
    return false;
  }
}
