import axios from 'axios';

export enum TrainingStatus { Success = 0, Fail = 1, UpToDate = 2, InProgress = 3, Queued = 9}

export interface LuisConfig {
    /**
     * Authoring region endpoint url
     * @example "https://westeurope.api.cognitive.microsoft.com/luis/api/v2.0/apps/
     * @see [Publishing regions]{@link https://docs.microsoft.com/en-us/azure/cognitive-services/LUIS/luis-reference-regions#publishing-regions}
     */
    authoringUrl: string;

    /**
     * Authoring key a.k.a. starter key
     * @see [Authoring key]{@link https://docs.microsoft.com/en-us/azure/cognitive-services/LUIS/luis-concept-keys#authoring-key}
     */
    authoringKey: string;
}

export interface EntityLabel {
    entityName: string;
    startCharIndex: number;
    endCharIndex: number;
}

export interface LabeledExample {
    text: string;
    intentName: string;
    entityLabels: EntityLabel[];
}

export interface ClosedListEntitySublist {
    canonicalForm: string;
    list: string[];
}

export interface TrainingResult {
    success: boolean;
    statusId: TrainingStatus;
    status?: any;
}

class LuisBaseAPI {
    private config: LuisConfig;

    constructor(config: LuisConfig) {
        this.config = config;
    }

    protected async getAllPages(pagedFunction: (skip: number, take: number) => Promise<any[]>) : Promise<any[]> {
        let skip = 0;
        const take = 100;
        let results = [];
        let page;
        do {
            page = await pagedFunction(skip, take);
            results = results.concat(page);
            skip = results.length;
        } while (page.length === take);
        return results;
    }

    protected async findInAllPages(pagedFunction: (skip: number, take: number) => Promise<any[]>, filter: (value: any) => any) : Promise<string> {
        const items = await this.getAllPages(pagedFunction);
        const filteredItems = items.filter(filter);
        return filteredItems && filteredItems[0] && filteredItems[0].id;
    }

    protected async get(api?: string) : Promise<any> {
        return await this.request('get', api);
    }

    protected async post(api?: string, data?: any) : Promise<any> {
        return await this.request('post', api, data);
    }

    protected async delete(api?: string) : Promise<any> {
        return await this.request('delete', api);
    }

    private async request(method: string, api?: string, data?: any) : Promise<any> {
        const result = await axios({
            method: method,
            baseURL: this.config.authoringUrl,
            url: api,
            data: data,
            headers: {
                'Ocp-Apim-Subscription-Key': this.config.authoringKey
            }
        });
        return result.data;
    }

    protected async delay(ms: number) : Promise<any> {
        return new Promise( resolve => setTimeout(resolve, ms) );
    }
}

class LuisAppsAPI extends LuisBaseAPI {
    constructor(config: LuisConfig) {
        super(config);
    }

    /**
     * Creates a new LUIS app.
     * @see [apps - Add Application]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c2f}
     * @async
     * @param name The application name.
     * @param description The application description.
     * @param culture The application culture (e.g. "en-us").
     * @param initialVersionId The application initial version.
     * @param usageScenario (optional) The application usage scenario (e.g. "IoT")
     * @param domain (optional) The application domain (e.g. "Car Manufacturing")
     * @returns The ID of the created application.
     */
    public async addApplication(name: string, description: string, culture: string, initialVersionId: string, usageScenario?: string, domain?: string) : Promise<string> {
        return await this.post("", {
            name: name,
            description: description,
            culture: culture,
            initialVersionId: initialVersionId,
            usageScenario: usageScenario,
            domain: domain
        });
    }

    /**
     * Deletes an application.
     * @see [apps - Delete Application]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c39}
     * @async
     * @param appId The application ID.
     * @returns The result of the deletion.
     */
    public async deleteApplication(appId: string) : Promise<any> {
        return await this.delete(`${appId}`);
    }

    /**
     * Gets the application info.
     * @see [apps - Get application info]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c37}
     * @async
     * @param appId The application ID.
     * @returns The application info.
     */
    public async getApplicationInfo(appId: string) : Promise<any> {
        return await this.get(`${appId}`);
    }

    /**
     * Lists all of the user applications.
     * @see [apps - Get applications list]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c30}
     * @async
     * @param skip (optional) The number of entries to skip. Default value is 0.
     * @param take (optional) The number of entries to return. Maximum page size is 500. Default is 100.
     * @returns The list of the user applications.
     */
    public async getApplicationsList(skip: number = 0, take: number = 100) : Promise<any> {
        return await this.get(`?skip=${skip}&take=${take}`);
    }

    /**
     * Find an application among the user applications.
     * @async
     * @param name The application name.
     * @returns The ID of the application if found.
     */
    public async findApplication(name: string) : Promise<string> {
        return await this.findInAllPages(
            async (skip, take) => await this.getApplicationsList(skip, take),
            app => app.name === name
        );
    }

    /**
     * Publishes a specific version of the application.
     * @see [apps - Publish application]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c3b}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param isStaging Should it be published in staging (true) or production (false) environment?
     * @param region The region to publish the application to. To publish to more than one region, use a comma-separated list e.g. "westus, southcentralus".
     * @returns The application endpoint details.
     */
    public async publishApplication(appId: string, versionId: string, isStaging: boolean, region: string) : Promise<any> {
        return await this.post(`${appId}/publish`, {
            versionId: versionId,
            isStaging: isStaging,
            region: region
        });
    }
}

class LuisExampleUtterancesAPI extends LuisBaseAPI {
    constructor(config: LuisConfig) {
        super(config);
    }

    /**
     * Adds a labeled example to the application.
     * @see [example utterances - Add label]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c08}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param utterance The example label.
     * @returns The ID of the created example.
     */
    public async addLabel(appId: string, versionId: string, utterance: LabeledExample) : Promise<string> {
        return await this.post(`${appId}/versions/${versionId}/example`, utterance);
    }

    /**
     * Adds a batch of non-duplicate labeled examples to the specified application. Batch can't include hierarchical child entities.
     * The maximum batch size is 100 items.
     * If the item has the ExampleId and a value between 0 - 99, the returned result will also include the ExampleId. This is helpful if items have errors.
     * Some items can pass while others fail. The returned result will indicate each item's status.
     * @see [example utterances - Batch add labels]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c09}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param labels An array containing non-duplicate example labels.
     * @returns The result of the request. The response contains an array determining the IDs of the added labels.
     */
    public async batchAddLabels(appId: string, versionId: string, utterances: LabeledExample[]) : Promise<any> {
        return await this.post(`${appId}/versions/${versionId}/examples`, utterances);
    }

    /**
     * Returns examples to be reviewed.
     * @see [example utterances - Review labeled examples]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c0a}
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param skip (optional) The number of entries to skip. Default value is 0.
     * @param take (optional) The number of entries to return. Maximum page size is 500. Default is 100.
     * @returns A list of predictions and label pairs for every example in the application.
     */
    public async reviewLabeledExamples(appId: string, versionId: string, skip: number = 0, take: number = 100) {
        return await this.get(`${appId}/versions/${versionId}/examples?skip=${skip}&take=${take}`);
    }
}

class LuisModelsAPI extends LuisBaseAPI {
    constructor(config: LuisConfig) {
        super(config);
    }

    /**
     * Adds a list of prebuilt entity extractors to the application.
     * @see [models - Add prebuilt entity list]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c16}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityNames An array of prebuilt entity extractor names (e.g. [ "datetimeV2" ]).
     * @returns An array of the created prebuilt extractor infos.
     */
    public async addPrebuiltEntityList(appId: string, versionId: string, entityNames: string[]) : Promise<any> {
        return await this.post(`${appId}/versions/${versionId}/prebuilts`, entityNames);
    }

    /**
     * Adds a list entity to the LUIS app.
     * @see [models - Create closed list entity]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c14}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityName The name of the new closed list entity extractor. The name of the entity must be unique in the application and must not be used by a prebuilt entity.
     * @param sublists The list of words for the new closed list entity extractor.
     * @returns The ID of the created model.
     */
    public async createClosedListEntity(appId: string, versionId: string, entityName: string, sublists: ClosedListEntitySublist[]) : Promise<string> {
        return await this.post(`${appId}/versions/${versionId}/closedlists`, { name: entityName, sublists: sublists });
    }

    /**
     * Adds an entity extractor to the application.
     * @see [models - Create entity]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c0e}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityName The name of the new entity extractor. The name of the entity must be unique in the application and must not be used by a prebuilt entity.
     * @returns The ID of the created model.
     */
    public async createEntity(appId: string, versionId: string, entityName: string) : Promise<string> {
        return await this.post(`${appId}/versions/${versionId}/entities`, { name: entityName });
    }

    /**
     * Adds a hierarchical entity extractor to the application version.
     * @see [models - Create hierarchical entity]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c10}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityName The name of the new entity extrator. The name of the entity must be unique in the application and must not be used by a prebuilt entity.
     * @param children The children of the new entity extractor.
     * @returns The ID of the created model.
     */
    public async createHierarchicalEntity(appId: string, versionId: string, entityName: string, children: string[]) : Promise<string> {
        return await this.post(`${appId}/versions/${versionId}/hierarchicalentities`, { name: entityName, children: children });
    }

    /**
     * Adds an intent classifier to the application.
     * @see [models - Create intent]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c0c}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param intentName The name of the new intent classifier.
     * @returns The ID of the created model.
     */
    public async createIntent(appId: string, versionId: string, intentName: string) : Promise<string> {
        return await this.post(`${appId}/versions/${versionId}/intents`, { name: intentName });
    }

    /**
     * Deletes a closed list model from the application.
     * @see [models - Delete closed list entity]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c29}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param clEntityId  The closed list entity extractor ID.
     * @returns If the operation was successful.
     */
    public async deleteClosedListEntity(appId: string, versionId: string, clEntityId: string) : Promise<any> {
        return await this.delete(`${appId}/versions/${versionId}/closedlists/${clEntityId}`);
    }

    /**
     * Deletes an entity extractor from the application.
     * @see [models - Delete entity]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c1f}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityId The entity extractor ID.
     * @returns If the operation was successful.
     */
    public async deleteEntity(appId: string, versionId: string, entityId: string) : Promise<any> {
        return await this.delete(`${appId}/versions/${versionId}/entities/${entityId}`);
    }

    /**
     * Deletes a hierarchical entity extractor from the application version.
     * @see [models - Delete hierarchical entity]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c22}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param hEntityId The hierarchical entity extractor ID.
     * @returns If the operation was successful.
     */
    public async deleteHierarchicalEntity(appId: string, versionId: string, hEntityId: string) : Promise<any> {
        return await this.delete(`${appId}/versions/${versionId}/hierarchicalentities/${hEntityId}`);
    }

    /**
     * Deletes an intent classifier from the application.
     * @see [models - Delete intent]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c1c}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param intentId The intent classifier ID.
     * @param deleteUtterances True means delete utterances from app, false means move utterances to None intent.
     * @returns If the operation was successful.
     */
    public async deleteIntent(appId: string, versionId: string, intentId: string, deleteUtterances: boolean) : Promise<any> {
        return await this.delete(`${appId}/versions/${versionId}/intents/${intentId}?deleteUtterances=${deleteUtterances}`);
    }

    /**
     * Deletes a prebuilt entity extractor from the application.
     * @see [models - Delete prebuilt entity]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c2b}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param prebuiltId he prebuilt entity extractor ID.
     * @returns If the operation was successful.
     */
    public async deletePrebuiltEntity(appId: string, versionId: string, prebuiltId: string) : Promise<any> {
        return await this.delete(`${appId}/versions/${versionId}/prebuilts/${prebuiltId}`);
    }

    /**
     * Gets information about the closedlist models.
     * @see [models - Get version closedlist list]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c15}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param skip (optional) The number of entries to skip. Default value is 0.
     * @param take (optional) The number of entries to return. Maximum page size is 500. Default is 100.
     * @returns A list of closedlist entity model infos.
     */
    public async getVersionClosedListList(appId: string, versionId: string, skip: number = 0, take: number = 100) : Promise<any> {
        return await this.get(`${appId}/versions/${versionId}/closedlists?skip=${skip}&take=${take}`);
    }

    /**
     * Find a closed list among all the closed list models.
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityName The closed list entity extractor name.
     * @returns The ID of the entity if found.
     */
    public async findVersionClosedListEntity(appId: string, versionId: string, entityName: string) : Promise<string> {
        return await this.findInAllPages(
            async (skip, take) => await this.getVersionClosedListList(appId, versionId, skip, take),
            entity => entity.name === entityName
        );
    }

    /**
     * Gets information about the entity models.
     * @see [models - Get version entity list]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c0f}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param skip (optional) The number of entries to skip. Default value is 0.
     * @param take (optional) The number of entries to return. Maximum page size is 500. Default is 100.
     * @returns A list of entity model infos.
     */
    public async getVersionEntityList(appId: string, versionId: string, skip: number = 0, take: number = 100) : Promise<any> {
        return await this.get(`${appId}/versions/${versionId}/entities?skip=${skip}&take=${take}`);
    }

    /**
     * Find an entity among all the entity models.
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityName The entity extractor name.
     * @returns The ID of the entity if found.
     */
    public async findVersionEntity(appId: string, versionId: string, entityName: string) : Promise<string> {
        return await this.findInAllPages(
            async (skip, take) => await this.getVersionEntityList(appId, versionId, skip, take),
            entity => entity.name === entityName
        );
    }

    /**
     * Gets information about the hierarchical entity models.
     * @see [models - Get version hierarchical entity list]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c11}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param skip (optional) The number of entries to skip. Default value is 0.
     * @param take (optional) The number of entries to return. Maximum page size is 500. Default is 100.
     * @returns A list of hierarchical entity model infos.
     */
    public async getVersionHierarchicalEntityList(appId: string, versionId: string, skip: number = 0, take: number = 100) : Promise<any> {
        return await this.get(`${appId}/versions/${versionId}/hierarchicalentities?skip=${skip}&take=${take}`);
    }

    /**
     * Find a hierarchical entity among all the hierarchical entity models.
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityName The hierarchical entity extractor name.
     * @returns The ID of the hierarchical entity if found.
     */
    public async findVersionHierarchicalEntity(appId: string, versionId: string, entityName: string) : Promise<string> {
        return await this.findInAllPages(
            async (skip, take) => await this.getVersionHierarchicalEntityList(appId, versionId, skip, take),
            entity => entity.name === entityName
        );
    }

    /**
     * Gets information about the intent models.
     * @see [models - Get version intent list]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c0d}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param skip (optional) The number of entries to skip. Default value is 0.
     * @param take (optional) The number of entries to return. Maximum page size is 500. Default is 100.
     * @returns A list of intent model infos.
     */
    public async getVersionIntentList(appId: string, versionId: string, skip: number = 0, take: number = 100) : Promise<any> {
        return await this.get(`${appId}/versions/${versionId}/intents?skip=${skip}&take=${take}`);
    }

    /**
     * Find an intent among all the intent classifiers.
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param intentName The intent classifier name.
     * @returns The ID of the intent if found.
     */
    public async findVersionIntent(appId: string, versionId: string, intentName: string) : Promise<string> {
        return await this.findInAllPages(
            async (skip, take) => await this.getVersionIntentList(appId, versionId, skip, take),
            intent => intent.name === intentName
        );
    }

    /**
     * Gets information about the prebuilt entity models.
     * @see [models - Get version prebuilt entity list]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c17}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param skip (optional) The number of entries to skip. Default value is 0.
     * @param take (optional) The number of entries to return. Maximum page size is 500. Default is 100.
     * @returns A list of prebuilt entity models infos.
     */
    public async getVersionPrebuiltEntityList(appId: string, versionId: string, skip: number = 0, take: number = 100) : Promise<any> {
        return await this.get(`${appId}/versions/${versionId}/prebuilts?skip=${skip}&take=${take}`);
    }

    /**
     * Find a prebuilt entity among all the prebuilt entity models.
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @param entityName The prebuilt entity name.
     * @returns The ID of the prebuilt entity if found.
     */
    public async findVersionPrebuiltEntity(appId: string, versionId: string, entityName: string) : Promise<string> {
        return await this.findInAllPages(
            async (skip, take) => await this.getVersionPrebuiltEntityList(appId, versionId, skip, take),
            entity => entity.name === entityName
        );
    }
}

class LuisTrainAPI extends LuisBaseAPI {
    constructor(config: LuisConfig) {
        super(config);
    }

    /**
     * Gets the training status of all models (intents and entities) for the specified LUIS app.
     * You must call the train API to train the LUIS app before you call this API to get training status.
     * @see [train - Get version training status]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c46}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @returns An array of training status details for the LUIS app. Each element in the response array provides training status for a model (intent or entity).
     */
    public async getVersionTrainingStatus(appId: string, versionId: string) : Promise<any> {
        return await this.get(`${appId}/versions/${versionId}/train`);
    }

    /**
     * Sends a training request for a version of a specified LUIS app.
     * @see [train - Train application version]{@link https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5890b47c39e2bb052c5b9c45}
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @returns The initial training status. If the response is Queued, keep polling at the get training status API to check for training completion.
     */
    public async trainApplicationVersion(appId: string, versionId: string) : Promise<any> {
        return await this.post(`${appId}/versions/${versionId}/train`);
    }

    /**
     * Sends a training request for a version of a specified LUIS app and waits for training completion.
     * It will return the final training status, so there is no need to keep pooling at the get training status API to check for training completion after calling this function.
     * @async
     * @param appId The application ID.
     * @param versionId The task version ID.
     * @returns The final training status.
     */
    public async trainApplicationVersionAndWaitForCompletion(appId: string, versionId: string) : Promise<TrainingResult> {
        let result = { success: false, statusId: TrainingStatus.Fail } as TrainingResult;
        const initialStatus = await this.trainApplicationVersion(appId, versionId);
        if (initialStatus.statusId === TrainingStatus.UpToDate) {
            result = { success: true, statusId: TrainingStatus.UpToDate };
        } else if (initialStatus.statusId === TrainingStatus.Queued) {
            let currentStatus;
            let inProgress = true;
            do {
                await this.delay(500);
                currentStatus = await this.getVersionTrainingStatus(appId, versionId);
                inProgress = currentStatus.some(s => s.details.statusId === TrainingStatus.InProgress);
            } while (inProgress);

            if (currentStatus.some(s => s.details.statusId === TrainingStatus.Fail)) {
                result = { success: false, statusId: TrainingStatus.Fail, status: currentStatus };
            } else if (currentStatus.every(s => s.details.statusId === TrainingStatus.UpToDate)) {
                result = { success: true, statusId: TrainingStatus.UpToDate };
            } else {
                result = { success: true, statusId: TrainingStatus.Success };
            }
        }
        return result;
    }
}

/**
 * LUIS Authoring v2.0 API client.
 * @author Alejandro Campos Magencio
 * @see https://aka.ms/luis-authoring-apis
 */
export class Luis {

    public apps: LuisAppsAPI;
    public utterances: LuisExampleUtterancesAPI;
    public models: LuisModelsAPI;
    public train: LuisTrainAPI;

    constructor(config: LuisConfig) {
        this.apps = new LuisAppsAPI(config);
        this.utterances = new LuisExampleUtterancesAPI(config);
        this.models = new LuisModelsAPI(config);
        this.train = new LuisTrainAPI(config);
    }
}
