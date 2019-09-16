import { MusicCard } from "./musiccard";
import { Deck, Ease } from "./deck";
import { Persistence } from "./persistence";
import { NoteInfo, FrequencyAnalyser } from "./frequencyanalyser";
import { Config } from "./config";
import { Player } from "./player";
import { SF2Parser } from './sf2parser';

const deckContents = {
    "C": ['C/4', 'D/4', 'E/4', 'F/4', 'G/4', 'A/4', 'B/4'],
    "D": ['D/4', 'E/4', 'F#/4', 'G/4', 'A/4', 'B/4', 'C#/5'],
    "F": ['F/4', 'G/4', 'A/4', 'Bb/4', 'C/5', 'D/5', 'E/5'],
    "Cb": ['Cb/4', 'Db/4', 'Eb/4', 'Fb/4', 'Gb/4', 'Ab/4', 'Bb/4']
};
const keySignatures = Object.keys(deckContents);

export class IndexPage {
    constructor() {
        this.frequencyAnalyser = null;
        this.lastRowCount = 0;
        this.canvas = null;
        this.canvasContext = null;
        this.decks = [];
        this.player = new Player(new SF2Parser(), "./sf2/KawaiStereoGrand.sf2", (player) => this.handleSoundFont(player));
        this.soundFontLoaded = false;
    }

    dispose() {
        if (this.frequencyAnalyser !== null) {
            this.frequencyAnalyser.dispose();
            this.frequencyAnalyser = null;
        }
        if (this.player !== null) {
            this.player.dispose();
            this.player = null;
        }
    }

    static generateDeck(keySignature) {
        const keys = deckContents[keySignature];
        const cards = [];
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                if (j === i) {
                    continue;
                }
                cards.push(new MusicCard(keySignature, keys[i], keys[j]));
            }
        }
        const deck = new Deck(keySignature, cards);
        return deck;
    }

    static generateConfig() {
        let config = new Config();
        return config;
    }

    getConfig() {
        return Config.instance();
    }

    showMenu() {
        // refresh the counts
        for (const deck of this.decks) {
            this.refreshRowForDeck(deck);
        }

        document.getElementById("main").hidden = false;
        document.getElementById("practice").hidden = true;
        document.getElementById("cards").hidden = true;
        document.getElementById("settings").hidden = true;
    }

    showCards(deck) {
        this.frequencyAnalyser.stop();
        this.frequencyAnalyser.keySignature = deck.deckId;
        this.frequencyAnalyser.start();
        document.getElementById("main").hidden = true;
        document.getElementById("practice").hidden = true;
        document.getElementById("cards").hidden = false;
        document.getElementById("settings").hidden = true;
        window.frames["cards"].src = "card.html";
        window.frames["cards"].onload = () => {
            window.frames["cards"].contentWindow.cardPage.setupCardPage(deck, this.player);
        };
    }

    showPractice(deck) {
        this.frequencyAnalyser.stop();
        this.frequencyAnalyser.keySignature = deck.deckId;
        this.frequencyAnalyser.start();
        document.getElementById("main").hidden = true;
        document.getElementById("cards").hidden = true;
        document.getElementById("practice").hidden = false;
        document.getElementById("settings").hidden = true;
        window.frames["practice"].src = "practice.html";
        window.frames["practice"].onload = () => {
            window.frames["practice"].contentWindow.practicePage.setupPracticePage(deck, this.player);
            console.log('indexpage: loaded practice');
        };
    }

    showSettings() {
        this.frequencyAnalyser.stop();
        document.getElementById("main").hidden = true;
        document.getElementById("cards").hidden = true;
        document.getElementById("practice").hidden = true;
        document.getElementById("settings").hidden = false;

        window.frames["settings"].src = "settings.html";
        window.frames["settings"].onload = () => {
            window.frames["settings"].contentWindow.settingsPage.setupSettingsPage();
            console.log('indexpage: loaded settings page');
        };
    }

    onFrequencyUpdate(noteInfo) {
        const currentNoteElement = document.getElementById('currentNote');
        if (!Number.isFinite(noteInfo.noteOffset)) {
            currentNoteElement.innerText = '';
        } else {
            currentNoteElement.innerText = noteInfo.noteName + '; ' + noteInfo.noteOffset + '; ' + noteInfo.cents.toFixed(2);
        }
        if (this.canvasContext !== null && this.canvas.hidden === false) {
            IndexPage.drawFrequencyData(this.canvasContext, this.frequencyAnalyser.frequencies, this.frequencyAnalyser.frequencyBucketSize, noteInfo);
        }
    }

    setupMic() {
        this.frequencyAnalyser = new FrequencyAnalyser(navigator);
        this.frequencyAnalyser.onFrequencyUpdateHandlers.push((noteInfo) => this.onFrequencyUpdate(noteInfo));
    }

    static drawFrequencyData(canvasContext, frequencies, frequencyBucketSize, noteInfo) {
        const width = 600;
        const height = 200;
        const bgStyle = 'rgb(0, 0, 0)';
        const fgStyle = 'rgb(128, 128, 128)';
        const peakStyle = 'rgb(255, 0, 0)';
        const noteStyle = 'rgb(0, 255, 0)';
        canvasContext.fillStyle = bgStyle;
        canvasContext.fillRect(0, 0, width, height);

        const bucketsPerPixel = Math.max(1, Math.floor(frequencies.length / width));
        const pixelsPerBucket = Math.max(1, Math.floor(width / frequencies.length));
        const barValues = new Array(Math.floor(width / pixelsPerBucket));
        const frequencyBarIndex = Math.floor((noteInfo.frequency / frequencyBucketSize) / bucketsPerPixel);
        const noteFrequencyBarIndex = Math.floor((noteInfo.noteFrequency / frequencyBucketSize) / bucketsPerPixel);
        for (let i = 0; i < barValues.length; i++) {
            const bucketIndexBase = bucketsPerPixel * i;
            let barHeight = 0;
            for (let bucketIndex = bucketIndexBase; bucketIndex < bucketIndexBase + bucketsPerPixel; bucketIndex++) {
                if (Number.isFinite(frequencies[bucketIndex])) {
                    barHeight += frequencies[bucketIndex];
                }
            }
            if (barHeight !== 0) { // we had at least one valid value
                barHeight = barHeight / bucketsPerPixel; // get the average value over the range
                barValues[i] = barHeight / bucketsPerPixel; // get the average value over the range
            } else {
                barValues[i] = undefined;
            }
        }
        const min = -120;
        const max = -10;
        canvasContext.fillStyle = fgStyle;
        barValues.forEach((value, index) => {
            const x = index;
            const normalizedValue = value === undefined ? 0 : (value - min) / (max - min);
            const y = normalizedValue * height;
            if (x === noteFrequencyBarIndex) {
                canvasContext.fillStyle = noteStyle;
                canvasContext.fillRect(x * pixelsPerBucket, height - y, pixelsPerBucket, y);
                canvasContext.fillStyle = fgStyle;
            } else if (x === frequencyBarIndex) {
                canvasContext.fillStyle = peakStyle;
                canvasContext.fillRect(x * pixelsPerBucket, height - y, pixelsPerBucket, y);
                canvasContext.fillStyle = fgStyle;
            } else {
                canvasContext.fillRect(x * pixelsPerBucket, height - y, pixelsPerBucket, y);
            }
        });
    }

    // TODO: hook something like this up if you really want web support, since people will inevitably decline mic permissions
    checkForMicrophoneAccess() {
        // Just boilerplate for filling in later with proper code
        navigator.permissions.query({ name: 'microphone' }).then(function (result) {
            if (result.state == 'granted') {

            } else if (result.state == 'prompt') {

            } else if (result.state == 'denied') {

            }
            result.onchange = function () {

            };
        });
    }

    toggleCanvas(event) {
        if (this.canvas === null) {
            return;
        }
        this.canvas.hidden = !this.canvas.hidden;
    }

    setupIndexPage() {
        this.canvas = document.getElementById("frequencyCanvas");
        this.canvasContext = (this.canvas !== null) ? this.canvas.getContext('2d') : null;
        document.getElementById('currentNote').onclick = (event) => this.toggleCanvas(event);
        this.setupMic();
        const persistence = new Persistence();
        persistence.whenReady(() => {
            // load up config
            persistence.loadConfig((success, config) => {
                let configInstance = Config.instance();
                if (success) {
                    if (config === undefined || config.length == 0) {
                        console.log("Generating new config");
                        config = IndexPage.generateConfig();
                        persistence.saveConfig(config, (success, savedConfig) => {
                            if (success) {
                                console.log('saved new config', savedConfig);
                            } else {
                                throw "Failed to save newly generated config";
                            }
                        });                        
                    }
                    else {
                        console.log('loaded config: ', config)
                    }
                    configInstance.setConfig(config.configMap);
                }
                else {
                    throw "failed to load config";
                }
            });

            // load up all the decks
            keySignatures.forEach((keySignature) => {
                persistence.loadDeck(keySignature, (success, loadedDeck) => {
                    if (success) {
                        if (loadedDeck === undefined) {
                            console.log("Generating new deck");
                            const newDeck = IndexPage.generateDeck(keySignature);
                            persistence.saveDeck(newDeck, (success, savedDeck) => {
                                if (success) {
                                    this.onReady(savedDeck);
                                } else {
                                    throw "Failed to save newly generated deck";
                                }
                            });
                        } else {
                            console.log("Loaded deck: ", loadedDeck);
                            this.onReady(loadedDeck);
                        }
                    } else {
                        throw "Failed to load deck";
                    }
                });
            });
        });

        document.getElementById("settingsButton").addEventListener("click", () => this.showSettings());
        document.getElementById("settingsButton").hidden = false;
    }

    addRowForDeck() {
        const tableElement = document.getElementById('decks');
        const tableRow = document.createElement('tr');
        this.lastRowCount++;
        const deckScaleElement = document.createElement('td');
        deckScaleElement.setAttribute('id', 'deckScale' + this.lastRowCount);
        tableRow.appendChild(deckScaleElement);
        const newElement = document.createElement('td');
        newElement.setAttribute('id', 'new' + this.lastRowCount);
        tableRow.appendChild(newElement);
        const learningElement = document.createElement('td');
        learningElement.setAttribute('id', 'learning' + this.lastRowCount);
        tableRow.appendChild(learningElement);
        const reviewElement = document.createElement('td');
        reviewElement.setAttribute('id', 'review' + this.lastRowCount);
        tableRow.appendChild(reviewElement);
        const buttonTableElement = document.createElement('td');
        const buttonElement = document.createElement('button');
        buttonElement.setAttribute('id', 'button' + this.lastRowCount);
        buttonElement.innerText = "Study Now";
        buttonElement.enabled = false;
        buttonTableElement.appendChild(buttonElement);
        tableRow.appendChild(buttonTableElement);
        const practiceButtonTableElement = document.createElement('td');
        const practiceButtonElement = document.createElement('button');
        practiceButtonElement.setAttribute('id', 'practiceButton' + this.lastRowCount);
        practiceButtonElement.innerText = "Practice Now";
        practiceButtonElement.enabled = false;
        practiceButtonTableElement.appendChild(practiceButtonElement);
        tableRow.appendChild(practiceButtonTableElement);
        tableElement.appendChild(tableRow);
    }

    refreshRowForDeck(inDeck) {
        const idSuffix = '' + (1 + keySignatures.indexOf(inDeck.deckId));
        document.getElementById("deckScale" + idSuffix).innerText = inDeck.deckId + ' Major';
        document.getElementById("new" + idSuffix).innerText = inDeck.newCount;
        document.getElementById("learning" + idSuffix).innerText = inDeck.learnCount;
        document.getElementById("review" + idSuffix).innerText = inDeck.reviewCount;
        const buttonElement = document.getElementById("button" + idSuffix);
        if (this.soundFontLoaded) {
            buttonElement.enabled = true;
            buttonElement.onclick = () => this.showCards(inDeck);
        }
        const practiceButtonElement = document.getElementById("practiceButton" + idSuffix);
        if (this.soundFontLoaded) {
            practiceButtonElement.enabled = true;
            practiceButtonElement.onclick = () => this.showPractice(inDeck);
        }
    }

    onReady(loadedDeck) {
        this.addRowForDeck();

        // A freshly loaded deck doesn't have valid counts yet. Reset them
        loadedDeck.resetNewCount();
        loadedDeck.resetLearnCount();
        loadedDeck.resetReviewCount();
        this.refreshRowForDeck(loadedDeck);

        this.decks.push(loadedDeck);
    }

    handleSoundFont(player) {
        this.soundFontLoaded = true;
        for (let loadedDeck of this.decks) {
            this.refreshRowForDeck(loadedDeck);
        }
    }
}

