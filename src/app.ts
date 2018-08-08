import { config }  from './config';
import { Luis } from './luis';

main();

async function main() {
    try {
        const luis = new Luis({
            authoringKey: config.get('LuisAuthoringKey'), authoringUrl: config.get('LuisAuthoringUrl')
        });

        // Create app
        console.log("Looking for app...");
        let appId = await luis.apps.findApplication("Test");
        if (!appId) {
            console.log("Adding new app...");
            appId = await luis.apps.addApplication("Test", "A test LUIS app created programmatically", "en-us", "0.1");
        }
        console.log(appId);
        console.log("Getting app info...");
        const appInfo = await luis.apps.getApplicationInfo(appId);
        const versionId = appInfo.activeVersion;
        console.log(appInfo);

        // Create intents
        console.log("Looking for Search intent...");
        let searchIntentId = await luis.models.findVersionIntent(appId, versionId, "Search");
        if (!searchIntentId) {
            console.log("Creating Search intent...");
            searchIntentId = await luis.models.createIntent(appId, versionId, "Search");
        }
        console.log(searchIntentId);

        // Create entities
        console.log("Looking for Object entity...");
        let objectEntityId = await luis.models.findVersionEntity(appId, versionId, "Object");
        if (!objectEntityId) {
            console.log("Creating Object entity...");
            objectEntityId = await luis.models.createEntity(appId, versionId, "Object");
        }
        console.log(objectEntityId);

        // Create hierarchical entities
        console.log("Looking for Location hierarchical entity...");
        let locationHEntityId = await luis.models.findVersionHierarchicalEntity(appId, versionId, "Location");
        if (!locationHEntityId) {
            console.log("Creating Location hierarchical entity...");
            locationHEntityId = await luis.models.createHierarchicalEntity(appId, versionId, "Location", ["From", "To"]);
        }
        console.log(locationHEntityId);

        // Create closed list entities
        console.log("Looking for SearchType closed list entity...");
        let searchTypeCLEntityId = await luis.models.findVersionClosedListEntity(appId, versionId, "SearchType");
        if (!searchTypeCLEntityId) {
            console.log("Creating SearchType closed list entity...");
            searchTypeCLEntityId = await luis.models.createClosedListEntity(appId, versionId, "SearchType", [
                { canonicalForm: "Flight", list: ["Flight", "Plane", "Flight Tickets", "Plane Tickets"]},
                { canonicalForm: "Train", list: ["Train", "Train Tickets"]},
                { canonicalForm: "Bus", list: ["Bus", "Bus Tickets"]}
            ]);
        }
        console.log(searchIntentId);

        // Add prebuilt entities
        console.log("Looking for prebuilt entities...");
        const prebuiltEntityId = await luis.models.findVersionPrebuiltEntity(appId, versionId, "datetimeV2");
        if (!prebuiltEntityId) {
            console.log("Adding prebuilt entities...");
            const prebuiltResult = await luis.models.addPrebuiltEntityList(appId, versionId, [ "datetimeV2" ]);
            console.log(prebuiltResult);
        } else {
            console.log(prebuiltEntityId);
        }

        // Add some sample utterances
        console.log("Adding utterances...");
        const utterancesResult = await luis.utterances.batchAddLabels(appId, versionId, [
            {
                text: "Search for a flight from Cairo to Redmond next Thursday",
                intentName: "Search",
                entityLabels: [
                    { entityName: "Location::From", startCharIndex: 25, endCharIndex: 29 },
                    { entityName: "Location::To", startCharIndex: 34, endCharIndex: 40 }
                ]
            },
            {
                text: "Find plane tickets from Madrid in two days",
                intentName: "Search",
                entityLabels: [
                    { entityName: "Location::From", startCharIndex: 24, endCharIndex: 29 }
                ]
            }
        ]);
        console.log(utterancesResult);

        // Get everything we have created up to date
        console.log("Getting intents...");
        const intents = await luis.models.getVersionIntentList(appId, versionId);
        console.log(intents);

        console.log("Getting entities...");
        const entities = await luis.models.getVersionEntityList(appId, versionId);
        console.log(entities);

        console.log("Getting hierarchical entities...");
        const hierarchicalEntities = await luis.models.getVersionHierarchicalEntityList(appId, versionId);
        console.log(hierarchicalEntities);

        console.log("Getting closed list entities...");
        const closedListEntities = await luis.models.getVersionClosedListList(appId, versionId);
        console.log(closedListEntities);

        console.log("Getting prebuilt entities...");
        const prebuiltEntities = await luis.models.getVersionPrebuiltEntityList(appId, versionId);
        console.log(prebuiltEntities);

        // Train and publish app
        console.log("Training app...");
        const trainingResult = await luis.train.trainApplicationVersionAndWaitForCompletion(appId, versionId);
        if (trainingResult.success) {
            console.log("Publishing app...");
            const publishedApp = await luis.apps.publishApplication(appId, versionId, false, "northeurope");
            console.log(`${publishedApp.endpointUrl}?subscription-key=${config.get('LuisEndpointKey')}&verbose=true&timezoneOffset=0&q=`);
            console.log("Done!");
        } else {
            console.log("Training failed");
            console.log(trainingResult);
        }

        console.log("Review utterances...");
        const utterances = await luis.utterances.reviewLabeledExamples(appId, versionId);
        console.log(utterances);

        // Deleting everything
        console.log("Deleting app...");
        const deleteResult = await luis.apps.deleteApplication(appId);
        console.log(deleteResult);

    } catch (err) {
        console.log(err);
    }
    console.log("We are done!");
}
