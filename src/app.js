/* eslint-disable no-unused-vars, no-undef, no-warning-comments */

import {Error as ApiError, Utils} from '@natlibfi/melinda-commons';
import {collect} from './interfaces/collect';
import {mongoFactory, HARVESTER_JOB_STATES} from '@natlibfi/melinda-record-link-migration-commons';
import {promisify} from 'util';

export default async function ({
  apiUrl, apiUsername, apiPassword, apiClientUserAgent, mongoUrl
}) {
  const {createLogger} = Utils;
  const logger = createLogger();
  const setTimeoutPromise = promisify(setTimeout);
  const eratuontiConfig = {apiUrl, apiUsername, apiPassword, apiClientUserAgent};
  const mongoOperator = await mongoFactory(mongoUrl);

  logger.log('info', 'Melinda-finto-harvester has started');

  return check();

  async function check(wait) {
    if (wait) {
      await setTimeoutPromise(3000);
      return check();
    }

    await checkJobsInState(HARVESTER_JOB_STATES.PROCESSING_FINTO_HARVESTING);
    await checkJobsInState(HARVESTER_JOB_STATES.PENDING_FINTO_HARVESTER);

    return check(true);
  }

  async function checkJobsInState(state) {
    // Get job from mongo
    const job = await mongoOperator.getOne(state);
    // Logger.log('debug', JSON.stringify(job, undefined, ' '));
    if (job === undefined || job === null) { // eslint-disable-line functional/no-conditional-statement
      logger.log('info', `No job in state: ${state}`);
      return;
    }
    logger.log('silly', `Job found:\n${JSON.stringify(job, undefined, ' ')}`);

    const {jobId, jobConfig} = job;
    await collect(jobId, jobConfig, mongoOperator, eratuontiConfig);

    // Check more work
    return check();
  }
}
