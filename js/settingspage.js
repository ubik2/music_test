import { Config } from "./config";
import { Persistence } from "./persistence";

export class SettingsPage {
    constructor() {
    }

    /**
     * Set up various fields that are dependent on objects not available at the time of construction.
     * This will generally be called after the page has loaded, so that the DOM objects are available.
     *
     */
    setupSettingsPage() {
        let config = this.getConfig();

        document.getElementById("newcards").value = config.getConfig()["new"]["perDay"];
        document.getElementById("reviewcards").value = config.getConfig()["review"]["perDay"];

        document.getElementById("submitButton").addEventListener("click", () => this.submitHandler());
        document.getElementById("main").hidden = false;
    }

    // save stuff function
    submitHandler() {
        let config = this.getConfig();
        config.getConfig()["new"]["perDay"] = parseInt(document.getElementById("newcards").value);
        config.getConfig()["review"]["perDay"] = parseInt(document.getElementById("reviewcards").value);

        const persistence = new Persistence();
        persistence.whenReady(() => {
            // load up config
            persistence.saveConfig(config, (success, savedDeck) => {
                console.log('saveConfig success=', success);
            });
        });

        // go back to main page
        window.parent.indexPage.showMenu(); 
    }

    getConfig() {
        return window.parent.indexPage.getConfig();
    }
}
