import { MusicCard } from "./musiccard";
import { Deck, Ease } from "./deck";
import { Persistence } from "./persistence";
import { FrequencyAnalyser } from "./frequencyanalyser";

const deckContents = {
    "C": ['C/4', 'D/4', 'E/4', 'F/4', 'G/4', 'A/4', 'B/4'],
    "D": ['D/4', 'E/4', 'F#/4', 'G/4', 'A/4', 'B/4', 'C#/5']
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
    document.getElementById("main").hidden = true;
    document.getElementById("cards").hidden = false;
    window.frames["cards"].src = "card.html";
    window.frames["cards"].onload = () => {
        window.frames["cards"].contentWindow.setupCardPage(deck);
    };
}

/// Experiments

function setupMicFromPlayer() {
    const player = document.getElementById('player');

    const handleSuccess = function(stream) {
        if (window.URL) {
            player.srcObject = stream;
        } else {
            player.src = stream;
        }
    };
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(handleSuccess);
}

function onFrequencyUpdate(noteInfo) {
    const currentNoteElement = document.getElementById('currentNote');
    if (!Number.isFinite(noteInfo.noteOffset)) {
        currentNoteElement.innerText = '';
    } else {
        currentNoteElement.innerText = noteInfo.note + '; ' + noteInfo.noteOffset + '; ' + noteInfo.cents.toFixed(2);
    }
    //console.log(noteInfo.frequency);
}

function setupMic() {
    const frequencyAnalyser = new FrequencyAnalyser(navigator);
    frequencyAnalyser.onFrequencyUpdateHandlers.push(onFrequencyUpdate);
}

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

    function onReady(loadedDeck) {
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
