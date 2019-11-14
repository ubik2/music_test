import { MusicCard } from "./music_card";
import { MusicScaleCard } from "./music_scale_card";
import { Deck } from "./deck";
import { Persistence } from "./persistence";
import { FrequencyAnalyser } from "./frequency_analyser";
import { Config } from "./config";
import { Player } from "./player";
import { SF2Parser } from './sf2_parser';
import { SuperMemoAnkiScheduler } from "./supermemo_anki_scheduler";
import { MusicCardPage } from "./music_card_page";
import { MusicScalePage } from "./music_scale_page";
import { PracticePage } from "./practice_page";
import { SettingsPage } from "./settings_page";

const musicDeckContents = {
    "C": ['C/4', 'D/4', 'E/4', 'F/4', 'G/4', 'A/4', 'B/4'],
    "D": ['D/4', 'E/4', 'F#/4', 'G/4', 'A/4', 'B/4', 'C#/5'],
    "F": ['F/4', 'G/4', 'A/4', 'Bb/4', 'C/5', 'D/5', 'E/5'],
    "Cb": ['Cb/4', 'Db/4', 'Eb/4', 'Fb/4', 'Gb/4', 'Ab/4', 'Bb/4']
};
const keySignatures = Object.keys(musicDeckContents);

export class IndexPage {
    constructor() {
        this.frequencyAnalyser = null;
        this.lastRowCount = 0;
        this.canvas = null;
        this.canvasContext = null;
        this.decks = [];
        this.player = new Player(new SF2Parser(), "./sf2/KawaiStereoGrand.sf2", (player) => this.handleSoundFont(player));
        this.soundFontLoaded = false;
        this.deckRows = {}; // mapping from row id to deck
        this.frameNames = ["main", "practice", "cards", "settings"];
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
        const keys = musicDeckContents[keySignature];
        const cards = [];
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                if (j === i) {
                    continue;
                }
                cards.push(new MusicCard(keySignature, keys[i], keys[j]));
            }
        }
        const deck = new Deck(keySignature + " Major", cards);
        deck.scheduler = new SuperMemoAnkiScheduler(deck, deck.logger, deck.random, deck.dateUtil);
        return deck;
    }

    static generateScalesDeck() {
        const scalesDeckContents = [ "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "A#", "Bb", "B" ]; // D#, "G#", 
        const cards = scalesDeckContents.map((keySignature) => new MusicScaleCard(keySignature));
        const deck = new Deck("Scales", cards);
        deck.scheduler = new SuperMemoAnkiScheduler(deck, deck.logger, deck.random, deck.dateUtil);
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

        this.showFrameByName("main");
        document.getElementById("settingsButton").hidden = false;
    }

    showFrameByName(frameName) {
        for (var currentFrameName of this.frameNames) {
            if (currentFrameName === frameName) {
                document.getElementById(currentFrameName).hidden = false;
            } else {
                document.getElementById(currentFrameName).hidden = true;
            }
        }
    }

    showCards(deck) {
        this.frequencyAnalyser.stop();
        if (deck.deckId !== "Scales") {
            this.frequencyAnalyser.keySignature = deck.deckId;
            this.frequencyAnalyser.start();
        }
        this.showFrameByName("cards");
        document.getElementById("settingsButton").hidden = true;
        window.frames["cards"].src = "card.html";
        window.frames["cards"].onload = () => {
            const cardsContentWindow = window.frames["cards"].contentWindow;
            let cardPage;
            if (deck.deckId !== "Scales") {
                cardPage = new MusicCardPage(cardsContentWindow.document, deck, this.player);
            } else {
                cardPage = new MusicScalePage(cardsContentWindow.document, deck, this.player);
            }
            window.frames["cards"].contentWindow.cardPage = cardPage;
            cardPage.getCard();
        };
    }

    showPractice(deck) {
        this.frequencyAnalyser.stop();
        this.frequencyAnalyser.keySignature = deck.deckId;
        this.frequencyAnalyser.start();
        this.showFrameByName("practice");
        document.getElementById("settingsButton").hidden = true;
        window.frames["practice"].src = "practice.html";
        window.frames["practice"].onload = () => {
            const practiceContentWindow = window.frames["practice"].contentWindow;
            console.log("loading practice");
            const practicePage = new PracticePage(practiceContentWindow.document, deck, this.player);
            console.log("CRETED practicepage");
            practiceContentWindow.practicePage = practicePage;
            console.log("CRETdrawing cardsED practicepage");
            practicePage.nextCards();
            console.log('indexpage: loaded practice');
        };
    }

    showSettings() {
        this.frequencyAnalyser.stop();
        this.showFrameByName("settings");
        document.getElementById("settingsButton").hidden = true;

        window.frames["settings"].src = "settings.html";
        window.frames["settings"].onload = () => {
            window.frames["settings"].contentWindow.settingsPage = new SettingsPage();
            window.frames["settings"].contentWindow.settingsPage.setupSettingsPage(window.frames["settings"].contentWindow.document);
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
                persistence.loadDeck(keySignature + " Major", (success, loadedDeck) => {
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
            // load up the scale deck
            persistence.loadDeck("Scales", (success, loadedDeck) => {
                if (success) {
                    if (loadedDeck === undefined) {
                        console.log("Generating new scale deck");
                        const newDeck = IndexPage.generateScalesDeck();
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

        document.getElementById("settingsButton").addEventListener("click", () => this.showSettings());
        document.getElementById("settingsButton").hidden = false;
    }

    addRowForDeck() {
        const tableElement = document.getElementById('decks');
        const tableRow = document.createElement('tr');
        this.lastRowCount++;
        const deckNameElement = document.createElement('td');
        deckNameElement.setAttribute('id', 'deckName' + this.lastRowCount);
        tableRow.appendChild(deckNameElement);
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
        const buttonElement = document.createElement('input');
        buttonElement.setAttribute("type", "button");
        buttonElement.setAttribute('id', 'button' + this.lastRowCount);
        buttonElement.setAttribute('class', 'button');
        buttonElement.setAttribute("value", "Study Now");
        buttonElement.disabled = true;
        buttonTableElement.appendChild(buttonElement);
        tableRow.appendChild(buttonTableElement);
        const practiceButtonTableElement = document.createElement('td');
        const practiceButtonElement = document.createElement('input');
        practiceButtonElement.setAttribute("type", "button");
        practiceButtonElement.setAttribute('id', 'practiceButton' + this.lastRowCount);
        practiceButtonElement.setAttribute('class', 'button');
        practiceButtonElement.setAttribute("value", "Practice Now");
        practiceButtonElement.disabled = true;
        practiceButtonTableElement.appendChild(practiceButtonElement);
        tableRow.appendChild(practiceButtonTableElement);
        tableElement.appendChild(tableRow);
        return this.lastRowCount;
    }

    refreshRowForDeck(inDeck) {
        const idSuffix = '' + this.deckRows[inDeck.deckId];
        document.getElementById("deckName" + idSuffix).innerText = inDeck.deckId;
        document.getElementById("new" + idSuffix).innerText = inDeck.scheduler.newCount;
        document.getElementById("learning" + idSuffix).innerText = inDeck.scheduler.learnCount;
        document.getElementById("review" + idSuffix).innerText = inDeck.scheduler.reviewCount;
        const buttonElement = document.getElementById("button" + idSuffix);
        if (this.soundFontLoaded) {
            buttonElement.disabled = false;
            buttonElement.onclick = () => this.showCards(inDeck);
        }
        const practiceButtonElement = document.getElementById("practiceButton" + idSuffix);
        if (this.soundFontLoaded && inDeck.deckId !== "Scales") {
            practiceButtonElement.disabled = false;
            practiceButtonElement.onclick = () => this.showPractice(inDeck);
        }
    }

    onReady(loadedDeck) {
        const rowId = this.addRowForDeck();
        this.deckRows[loadedDeck.deckId] = rowId;

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

