/* eslint-disable require-jsdoc */
'use strict';

const namespace = 'one.xord.ddi';

/**
 * Accept data request
 * @param {one.xord.ddi.acceptRequest} tx - accept request
 * @transaction
 */
async function acceptRequest(tx) {
    let requestsRegistry = await getAssetRegistry(namespace + '.Request');

    try {
        let request = await requestsRegistry.get(tx.requestId);
        request.status = 'ACCEPTED';
        await requestsRegistry.update(request);
    } catch (error) {
        console.error(error);
    }
}