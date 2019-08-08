import { MusicCard } from "./musiccard";
import { Deck, Ease } from "./deck";
import { Persistence } from "./persistence";
import { FrequencyAnalyser } from "./frequencyanalyser";

const deckContents = {
    "C": ['C/4', 'D/4', 'E/4', 'F/4', 'G/4', 'A/4', 'B/4'],
    "D": ['D/4', 'E/4', 'F#/4', 'G/4', 'A/4', 'B/4', 'C#/5'],
    "F": ['F/4', 'G/4', 'A/4', 'Bb/4', 'C/5', 'D/5', 'E/5'],
    "Cb": ['Cb/4', 'Db/4', 'Eb/4', 'Fb/4', 'Gb/4', 'Ab/4', 'Bb/4']
};
const keySignatures = Object.keys(deckContents);
function generateDeck(keySignature) {
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

function showCards(deck) {
    frequencyAnalyser.stop();
    frequencyAnalyser.keySignature = deck.deckId;
    frequencyAnalyser.start();
    document.getElementById("main").hidden = true;
    document.getElementById("cards").hidden = false;
    window.frames["cards"].src = "card.html";
    window.frames["cards"].onload = () => {
        window.frames["cards"].contentWindow.setupCardPage(deck);
    };
}

function onFrequencyUpdate(noteInfo) {
    const currentNoteElement = document.getElementById('currentNote');
    if (!Number.isFinite(noteInfo.noteOffset)) {
        currentNoteElement.innerText = '';
    } else {
        currentNoteElement.innerText = noteInfo.noteName + '; ' + noteInfo.noteOffset + '; ' + noteInfo.cents.toFixed(2);
    }
    //console.log(noteInfo.frequency);
}

let frequencyAnalyser;
function setupMic() {
    frequencyAnalyser = new FrequencyAnalyser(navigator);
    frequencyAnalyser.onFrequencyUpdateHandlers.push(onFrequencyUpdate);
}

// TODO: hook something like this up if you really want web support, since people will inevitably decline mic permissions
function checkForMicrophoneAccess() {
    // Just boilerplate for filling in later with proper code
    navigator.permissions.query({name:'microphone'}).then(function(result) {
        if (result.state == 'granted') {
      
        } else if (result.state == 'prompt') {
      
        } else if (result.state == 'denied') {
      
        }
        result.onchange = function() {
      
        };
    });
}

function setupIndexPage() {
    setupMic();
    const persistence = new Persistence();
    persistence.whenReady(() => {
        keySignatures.forEach((keySignature) => {
            persistence.loadDeck(keySignature, (success, loadedDeck) => {
                if (success) {
                    if (loadedDeck === undefined) {
                        console.log("Generating new deck");
                        const newDeck = generateDeck(keySignature);
                        persistence.saveDeck(newDeck, (success, savedDeck) => {
                            if (success) {
                                onReady(savedDeck);
                            } else {
                                throw "Failed to save newly generated deck";
                            }
                        });
                    } else {
                        console.log("Loaded deck: ", loadedDeck);
                        onReady(loadedDeck);
                    }
                } else {
                    throw "Failed to load deck";
                }
            });
        });
    });

    let lastRowCount = 0;
    function addRowForDeck() {
        const tableElement = document.getElementById('decks');
        const tableRow = document.createElement('tr');
        lastRowCount++;
        const deckScaleElement = document.createElement('td');
        deckScaleElement.setAttribute('id', 'deckScale' + lastRowCount);
        tableRow.appendChild(deckScaleElement);
        const newElement = document.createElement('td');
        newElement.setAttribute('id', 'new' + lastRowCount);
        tableRow.appendChild(newElement);
        const learningElement = document.createElement('td');
        learningElement.setAttribute('id', 'learning' + lastRowCount);
        tableRow.appendChild(learningElement);
        const reviewElement = document.createElement('td');
        reviewElement.setAttribute('id', 'review' + lastRowCount);
        tableRow.appendChild(reviewElement);
        const buttonTableElement = document.createElement('td');
        const buttonElement = document.createElement('button');
        buttonElement.setAttribute('id', 'button' + lastRowCount);
        buttonElement.innerText = "Study Now";
        buttonTableElement.appendChild(buttonElement);
        tableRow.appendChild(buttonTableElement);
        tableElement.appendChild(tableRow);
    }

    function onReady(loadedDeck) {
        addRowForDeck();
        // A freshly loaded deck doesn't have valid counts yet. Reset them
        loadedDeck.resetNewCount();
        loadedDeck.resetLearnCount();
        loadedDeck.resetReviewCount();
        const idSuffix = '' + (1 + keySignatures.indexOf(loadedDeck.deckId));
        document.getElementById("deckScale" + idSuffix).innerText = loadedDeck.deckId + ' Major';
        document.getElementById("new" + idSuffix).innerText = loadedDeck.newCount;
        document.getElementById("learning" + idSuffix).innerText = loadedDeck.learnCount;
        document.getElementById("review" + idSuffix).innerText = loadedDeck.reviewCount;
        document.getElementById("button" + idSuffix).onclick = () => showCards(loadedDeck);
    }
}



// Export this setup function so we can run it after we finish loading
window.setupIndexPage = setupIndexPage;
