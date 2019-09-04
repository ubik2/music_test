

export const LeechAction = {
    SUSPEND: 0,
    TAG_ONLY: 1
};

let configSingleton = null;

// For these config properties, I kept the anki names, to facilitate sharing JSON config
// eventually this should be a json file, but lets just make it easy for now
export class Config {
    constructor(logger = null) {
        this.configMap = { // TODO: these should be loaded as user preferences
            new: {
                delays: [1, 10],
                ints: [1, 4, 7],
                initialFactor: 2500, // STARTING_FACTOR
                perDay: 4,
                bury: false
                // separate, order
            },
            lapse: {
                delays: [10],
                mult: 0,
                minInt: 1,
                leechFails: 8,
                leechAction: LeechAction.SUSPEND
                // resched
            },
            review: {
                perDay: 200,
                ease4: 1.3,
                fuzz: 0.05,
                ivlFct: 1,
                maxIvl: 36500,
                bury: false,
                hardFactor: 1.2
            }
        };
    }

    setConfig(inConfig) {
        this.configMap = inConfig;
    }
    getConfig() {
        return this.configMap;
    }
    
    /**
     * Gets a shared instance of Config
     * 
     * @return {Config} shared config instance
     */
    static instance() {
        if (configSingleton === null) {
            configSingleton = new Config();
        }
        return configSingleton;
    }
}
