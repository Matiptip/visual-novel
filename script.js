let currentlySelectedSlot = -1;

// const GAMEPAD_BUTTON_A = 0; // Typical 'A' button
// const GAMEPAD_DPAD_UP = 12;
// const GAMEPAD_DPAD_DOWN = 13;

// --- GAMEPAD CONTROLS CONFIGURATION ---
// The `gamepadControls` object is used to map game actions to specific gamepad button indices.
// This allows for customization of controls if the default mappings don't suit a particular gamepad.
//
// Structure:
//   - `actions`: An object where each key is a game action (e.g., 'CONFIRM', 'NAV_UP') and
//     its value is the numerical button index on the gamepad.
//
// Standard Gamepad API Mapping:
// The default indices are based on the Standard Gamepad API mapping:
//   - 0: 'A' (bottom face button, often Cross on PlayStation)
//   - 1: 'B' (right face button, often Circle on PlayStation)
//   - 9: 'Start' (or 'Options')
//   - 12: D-pad Up
//   - 13: D-pad Down
//   - 14: D-pad Left
//   - 15: D-pad Right
// However, some gamepads may not adhere strictly to this standard.
//
const gamepadControls = {
    actions: {
        CONFIRM: 0,      // Action to confirm a choice or advance text. Default: Button 0 (e.g., 'A' on Xbox, 'Cross' on PlayStation).
        CANCEL: 1,      // Action to cancel or go back (not currently used). Default: Button 1 (e.g., 'B' on Xbox, 'Circle' on PlayStation).
        MENU: 9,        // Action to open a menu (not currently used). Default: Button 9 (e.g., 'Start' or 'Options').
        NAV_UP: 12,     // Navigate up in choices. Default: D-pad Up (Button 12).
        NAV_DOWN: 13,   // Navigate down in choices. Default: D-pad Down (Button 13).
        NAV_LEFT: 14,   // Navigate left (not currently used). Default: D-pad Left (Button 14).
        NAV_RIGHT: 15   // Navigate right (not currently used). Default: D-pad Right (Button 15).
    }
    // Future: Add deadzone configurations for analog sticks or multiple control profiles here.
};

// --- HOW TO FIND GAMEPAD BUTTON INDICES ---
// If your gamepad doesn't work with the default settings, you might need to find the correct button indices.
//
// Methods:
// 1. Online Gamepad Testers:
//    - Search for "gamepad tester" or "html5 gamepad tester" in your web browser.
//    - These tools usually display connected gamepads and show button/axis activity with their indices.
//
// 2. Temporary Logging in this Script:
//    - You can temporarily modify the `updateGamepadState()` function in this script to log button presses.
//    - Open your browser's developer console (usually by pressing F12) to see the logs.
//    - Add the following snippet inside the `if (gamepad)` block in `updateGamepadState()`:
//
//      /* --- Start of temporary logging snippet ---
//      gamepad.buttons.forEach((button, index) => {
//          if (button.pressed) {
//              console.log(`Gamepad button pressed: Index ${index}, Value ${button.value}, Pressed: ${button.pressed}`);
//          }
//      });
//      gamepad.axes.forEach((axis, index) => {
//          if (Math.abs(axis) > 0.1) { // Log only if axis is significantly moved
//             console.log(`Gamepad axis moved: Index ${index}, Value ${axis}`);
//          }
//      });
//      /* --- End of temporary logging snippet --- */
//
//    - Remember to remove this temporary code after you've identified your button indices!

// --- HOW TO CUSTOMIZE GAMEPAD CONTROLS ---
// 1. Identify the action you want to change in the `gamepadControls.actions` object above
//    (e.g., `CONFIRM`, `NAV_UP`).
// 2. Connect the gamepad you want to configure to your computer.
// 3. Use one of the methods described in "HOW TO FIND GAMEPAD BUTTON INDICES" (above)
//    to find the numerical index for the physical button you want to assign to that action.
// 4. Update the number (button index) for the corresponding action in the `gamepadControls.actions` object.
//    For example, if you want the 'CONFIRM' action to be triggered by button 5 on your gamepad,
//    you would change `CONFIRM: 0,` to `CONFIRM: 5,`.
// 5. Save this `script.js` file.
// 6. Refresh the visual novel in your browser to test the new mapping.
//
// Note on D-pads and Axes:
//   - This engine's current gamepad implementation primarily handles D-pad navigation
//     (NAV_UP, NAV_DOWN, etc.) as button presses (indices 12-15 in the Standard Gamepad API).
//   - Some gamepads, or under certain drivers/OS, might report D-pad inputs as changes
//     on an "axis" (e.g., axis 9 changing from -1 to 1).
//   - If your D-pad isn't working and you find it's axis-based using the logging method,
//     advanced customization would be needed in the `updateGamepadState()` function to read
//     `gamepad.axes[]` and interpret those values for navigation. This is beyond the scope
//     of simple mapping changes in `gamepadControls.actions`.
//

let prevGamepadButtonStates = {};

// Helper function to detect a new gamepad button press
function isGamepadButtonPressed(buttonIndex, gamepad) {
    const isPressed = gamepad.buttons[buttonIndex] && gamepad.buttons[buttonIndex].pressed;
    const wasPressed = prevGamepadButtonStates[buttonIndex];
    // prevGamepadButtonStates[buttonIndex] will be updated in updateGamepadState after all checks
    return isPressed && !wasPressed;
}

// Game state
const gameState = {
    currentScene: 0,
    variables: {},
    characters: {
        protagonist: { name: "Protagonist", visible: false, emotion: "neutral" },
        heroine: { name: "Heroine", visible: false, emotion: "neutral" }
    },
    saveSlots: Array(6).fill(null),
    choiceHistory: [],
    gamepadSelectedChoiceIndex: -1
};

// --- STORY DATA STRUCTURE ---
// The `story` array holds all the scenes for the visual novel. Each scene is an object
// with several properties that define its content and behavior.
//
// Scene Properties:
//   - `background`: (String) URL of the background image for the scene.
//   - `text`: (String) The dialogue or narrative text to be displayed.
//   - `characters`: (Array of Objects) Defines characters present in the scene.
//     - `name`: (String) Identifier for the character (e.g., "protagonist", "heroine").
//     - `visible`: (Boolean) Whether the character is visible.
//     - `emotion`: (String) The emotion state of the character (used to potentially select different sprites).
//     - `position`: (String) "left", "right", or "center" (though center might need specific CSS).
//     - `speaking`: (Boolean, optional) If true, might apply a visual highlight.
//   - `choices`: (Array of Objects or null) Defines player choices for the scene.
//     - `text`: (String) Text displayed for the choice option.
//     - `nextScene`: (Integer) Index of the scene to jump to if this choice is selected.
//     If `choices` is null or an empty array, no choices are displayed.
//   - `disableNextButton`: (Boolean, optional) Controls visibility of the "Next" button for scenes without choices.
//     - **Purpose:** Set to `true` to prevent the "Next" button from appearing for scenes
//       that do not have choices. This is useful for explicitly ending a narrative branch
//       or a sequence of scenes where automatic progression to the next scene in the array
//       is not desired.
//     - **Usage:**
//       - If a scene has a `choices` array (even if empty, though typically it would have options),
//         the "Next" button is automatically hidden, and this property has no effect.
//       - This property primarily affects scenes with no `choices` (or `choices: null`).
//       - If `disableNextButton: true`, the "Next" button will be hidden.
//       - If `disableNextButton` is not present, or set to `false` (and the scene has no choices,
//         and it's not the very last scene of the entire story), the "Next" button will appear.
//     - **Default Behavior:** If `disableNextButton` is omitted for a scene without choices,
//       the "Next" button will be shown (unless it's the last scene in the `story` array,
//       in which case the "Next" button is also hidden by default to prevent errors).
//     - **Example:**
//       // {
//       //   background: "path/to/image.jpg",
//       //   text: "This is the end of this particular path. You cannot proceed further this way.",
//       //   characters: [{ name: "protagonist", visible: true }],
//       //   choices: null, // Or omit the choices property
//       //   disableNextButton: true // Prevents the 'Next' button from appearing
//       // },
//       // {
//       //   background: "path/to/another.jpg",
//       //   text: "This scene will show a 'Next' button to go to the scene after it in the array.",
//       //   characters: [],
//       //   choices: null // 'Next' button will appear (unless this is the last scene in the story array)
//       // }

// Sample story data
const story = [
    {
        background: "https://images.unsplash.com/photo-1605106702734-205df224ecce?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
        text: "It was a quiet evening in the small town of Maplewood. The autumn leaves rustled in the gentle breeze as I walked home from school.",
        characters: [
            { name: "protagonist", visible: true, emotion: "neutral", position: "left" }
        ],
        choices: null
    },
    {
        background: "https://images.unsplash.com/photo-1605106702734-205df224ecce?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
        text: "As I turned the corner, I saw her—the new transfer student, standing alone under the old oak tree.",
        characters: [
            { name: "protagonist", visible: true, emotion: "surprised", position: "left" },
            { name: "heroine", visible: true, emotion: "neutral", position: "right" }
        ],
        choices: null
    },
    {
        background: "https://images.unsplash.com/photo-1605106702734-205df224ecce?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
        text: "She looked up and our eyes met. What should I do?",
        characters: [
            { name: "protagonist", visible: true, emotion: "neutral", position: "left" },
            { name: "heroine", visible: true, emotion: "shy", position: "right" }
        ],
        choices: [
            { text: "Approach her and say hello", nextScene: 3 },
            { text: "Pretend I didn't see her and keep walking", nextScene: 4 },
            { text: "Wave from a distance", nextScene: 5 }
        ]
    }
];

// DOM elements
const elements = {
    backgroundImage: document.getElementById('background-image'),
    textBox: document.getElementById('text-box'),
    choicesContainer: document.getElementById('choices-container'),
    nextButton: document.getElementById('next-button'),
    characterContainer: document.getElementById('character-container'),
    menuButton: document.getElementById('menu-button'),
    quickMenu: document.getElementById('quick-menu'),
    saveButton: document.getElementById('save-button'),
    loadButton: document.getElementById('load-button'),
    saveLoadModal: document.getElementById('save-load-modal'),
    saveTab: document.getElementById('save-tab'),
    loadTab: document.getElementById('load-tab'),
    saveSlots: document.getElementById('save-slots'),
    loadSlots: document.getElementById('load-slots'),
    closeSaveLoad: document.getElementById('close-save-load'),
    confirmSaveLoad: document.getElementById('confirm-save-load'),
    settingsButton: document.getElementById('settings-button'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings')
};

// Initialize the game
function initGame() {
    // Set up event listeners
    elements.nextButton.addEventListener('click', advanceStory);
    elements.menuButton.addEventListener('click', toggleQuickMenu);
    elements.saveButton.addEventListener('click', () => showSaveLoadModal('save'));
    elements.loadButton.addEventListener('click', () => showSaveLoadModal('load'));
    elements.settingsButton.addEventListener('click', showSettingsModal);
    elements.closeSettings.addEventListener('click', hideSettingsModal);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.closeSaveLoad.addEventListener('click', hideSaveLoadModal);
    elements.confirmSaveLoad.addEventListener('click', confirmSaveLoad);
    elements.saveTab.addEventListener('click', () => switchSaveLoadTab('save'));
    elements.loadTab.addEventListener('click', () => switchSaveLoadTab('load'));
    
    // Initialize save slots
    renderSaveSlots();

    // Initialize Gamepad
    initGamepad();
    
    // Start the game
    loadScene(gameState.currentScene);
}

// Load a scene
function loadScene(sceneIndex) {
    const scene = story[sceneIndex];
    
    // Change background
    elements.backgroundImage.src = scene.background;
    elements.backgroundImage.classList.add('opacity-0');
    setTimeout(() => {
        elements.backgroundImage.classList.remove('opacity-0');
    }, 1000);
    
    // Update characters
    if (scene.characters) {
        updateCharacters(scene.characters);
    } else {
        updateCharacters([]); // Clear characters if scene doesn't define any
    }
    
    // Display text
    displayText(scene.text);
    
    // Show choices or next button
    if (scene.choices && scene.choices.length > 0) {
        showChoices(scene.choices); // showChoices should hide the nextButton
    } else {
        hideChoices(); // hideChoices no longer manages nextButton visibility
        if (scene.disableNextButton === true || sceneIndex === story.length - 1) {
            elements.nextButton.classList.add('hidden');
        } else {
            elements.nextButton.classList.remove('hidden');
        }
    }
    
    // Update game state
    gameState.currentScene = sceneIndex;
}

// Update character display
function updateCharacters(characters) {
    // Hide all characters first
    document.querySelectorAll('.character img').forEach(img => {
        img.classList.add('opacity-0', 'translate-y-10');
        img.nextElementSibling.classList.add('opacity-0');
    });
    
    // Show and position active characters
    characters.forEach(char => {
        if (char.visible) {
            const charElement = document.querySelector(`.character[data-character="${char.name}"] img`);
            const nameTag = charElement.nextElementSibling;
            
            // Update character image based on emotion
            // In a real game, you'd have different images for each emotion
            charElement.src = `https://i.imgur.com/${getCharacterImage(char.name, char.emotion)}`;
            
            // Position character
            if (char.position === 'left') {
                charElement.parentElement.classList.remove('ml-auto');
                charElement.parentElement.classList.add('mr-auto');
            } else {
                charElement.parentElement.classList.remove('mr-auto');
                charElement.parentElement.classList.add('ml-auto');
            }
            
            // Show character with animation
            setTimeout(() => {
                charElement.classList.remove('opacity-0', 'translate-y-10');
                nameTag.classList.remove('opacity-0');
                nameTag.textContent = gameState.characters[char.name].name;
            }, 300);
            
            // Highlight speaking character
            if (char.speaking) {
                charElement.classList.add('character-highlight');
            } else {
                charElement.classList.remove('character-highlight');
            }
        }
    });
}

// Helper function to get character images (mock)
function getCharacterImage(name, emotion) {
    // In a real game, you'd have a mapping of character+emotion to image URLs
    if (name === "protagonist") return "JYw6X9E.png";
    if (name === "heroine") return "5Z3W5yJ.png";
    return "JYw6X9E.png";
}

// Display text with typewriter effect
function displayText(text) {
    elements.textBox.innerHTML = '';
    elements.textBox.classList.remove('fade-in');
    
    // Create a temporary element to measure height
    const tempElement = document.createElement('div');
    tempElement.style.visibility = 'hidden';
    tempElement.style.position = 'absolute';
    tempElement.style.whiteSpace = 'pre-wrap';
    tempElement.style.width = getComputedStyle(elements.textBox).width;
    tempElement.innerHTML = text;
    document.body.appendChild(tempElement);
    
    // Calculate if we need to scroll
    const needsScroll = tempElement.offsetHeight > elements.textBox.offsetHeight;
    document.body.removeChild(tempElement);
    
    // If text is too long, split into pages
    if (needsScroll) {
        const words = text.split(' ');
        let currentPage = '';
        let pageBreakIndex = Math.floor(words.length / 2);
        
        for (let i = 0; i < words.length; i++) {
            currentPage += words[i] + ' ';
            
            if (i === pageBreakIndex - 1) {
                elements.textBox.innerHTML += `<p class="mb-4">${currentPage}</p>`;
                currentPage = '';
            }
        }
        
        if (currentPage) {
            elements.textBox.innerHTML += `<p>${currentPage}</p>`;
        }
    } else {
        elements.textBox.innerHTML = `<p>${text}</p>`;
    }
    
    elements.textBox.classList.add('fade-in');
    
    // Scroll to bottom
    setTimeout(() => {
        elements.textBox.scrollTop = elements.textBox.scrollHeight;
    }, 100);
}

// Show choices
function showChoices(choices) {
    elements.choicesContainer.innerHTML = '';
    gameState.gamepadSelectedChoiceIndex = -1; // Reset
    
    choices.forEach((choice, index) => {
        const choiceElement = document.createElement('div');
        choiceElement.className = 'bg-gray-700 hover:bg-gray-600 p-3 rounded-lg cursor-pointer transition-colors slide-up';
        choiceElement.style.animationDelay = `${index * 0.1}s`;
        choiceElement.textContent = choice.text;
        choiceElement.addEventListener('click', () => {
            const choiceDetails = {
                sceneIndex: gameState.currentScene,
                choiceText: choice.text,
                nextScene: choice.nextScene
            };
            gameState.choiceHistory.push(choiceDetails);
            loadScene(choice.nextScene);
        });
        elements.choicesContainer.appendChild(choiceElement);
    });

    if (choices.length > 0) {
        gameState.gamepadSelectedChoiceIndex = 0;
        elements.choicesContainer.children[0].classList.add('gamepad-selected');
    }
    
    elements.choicesContainer.classList.remove('hidden');
    elements.nextButton.classList.add('hidden');
}

// Hide choices
function hideChoices() {
    if (gameState.gamepadSelectedChoiceIndex !== -1 && elements.choicesContainer.children[gameState.gamepadSelectedChoiceIndex]) {
        elements.choicesContainer.children[gameState.gamepadSelectedChoiceIndex].classList.remove('gamepad-selected');
    }
    gameState.gamepadSelectedChoiceIndex = -1;
    elements.choicesContainer.classList.add('hidden');
    // elements.nextButton.classList.remove('hidden'); // Next button visibility is now handled by loadScene
}

// Advance the story
function advanceStory() {
    if (gameState.currentScene < story.length - 1) {
        loadScene(gameState.currentScene + 1);
    } else {
        // End of demo
        displayText("This is the end of the demo. Thank you for playing!");
        elements.nextButton.classList.add('hidden');
    }
}

// Toggle quick menu
function toggleQuickMenu() {
    elements.quickMenu.classList.toggle('hidden');
}

// Show save/load modal
function showSaveLoadModal(mode) {
    elements.saveLoadModal.classList.remove('hidden');
    switchSaveLoadTab(mode);
}

// Hide save/load modal
function hideSaveLoadModal() {
    elements.saveLoadModal.classList.add('hidden');
}

// Switch between save and load tabs
function switchSaveLoadTab(mode) {
    if (mode === 'save') {
        elements.saveTab.classList.add('bg-indigo-700');
        elements.saveTab.classList.remove('bg-gray-800');
        elements.loadTab.classList.remove('bg-indigo-700');
        elements.loadTab.classList.add('bg-gray-800');
        elements.saveSlots.classList.remove('hidden');
        elements.loadSlots.classList.add('hidden');
        elements.confirmSaveLoad.textContent = 'Save';
    } else {
        elements.loadTab.classList.add('bg-indigo-700');
        elements.loadTab.classList.remove('bg-gray-800');
        elements.saveTab.classList.remove('bg-indigo-700');
        elements.saveTab.classList.add('bg-gray-800');
        elements.loadSlots.classList.remove('hidden');
        elements.saveSlots.classList.add('hidden');
        elements.confirmSaveLoad.textContent = 'Load';
    }
}

// Confirm save/load action
function confirmSaveLoad() {
    if (currentlySelectedSlot >= 0 && currentlySelectedSlot < 6) {
        const action = elements.confirmSaveLoad.textContent;
        const slotKey = `saveSlot_${currentlySelectedSlot}`;

        if (action === 'Save') {
            const saveData = {
                timestamp: new Date().toISOString(),
                sceneIndex: gameState.currentScene,
                sceneText: story[gameState.currentScene].text.substring(0, 50) + (story[gameState.currentScene].text.length > 50 ? '...' : ''),
                fullGameState: JSON.parse(JSON.stringify(gameState)) // Deep copy
            };
            localStorage.setItem(slotKey, JSON.stringify(saveData));
            renderSaveSlots();
            alert("Game Saved!");
        } else if (action === 'Load') {
            const savedDataString = localStorage.getItem(slotKey);
            if (savedDataString) {
                const loadedSaveData = JSON.parse(savedDataString);
                Object.assign(gameState, loadedSaveData.fullGameState);
                // Ensure choiceHistory is an array after loading, as Object.assign might not preserve it if it was undefined in loadedSaveData.fullGameState
                if (!Array.isArray(gameState.choiceHistory)) {
                    gameState.choiceHistory = [];
                }
                loadScene(gameState.currentScene);
                alert("Game Loaded!");
            } else {
                alert("Empty slot or corrupted data.");
            }
        }
    } else {
        alert("Please select a slot first.");
    }
    hideSaveLoadModal();
}

// Render save slots
function renderSaveSlots() {
    elements.saveSlots.innerHTML = '';
    elements.loadSlots.innerHTML = '';
    
    for (let i = 0; i < 6; i++) {
        const slot = document.createElement('div');
        slot.className = 'bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors';
        
        const savedDataString = localStorage.getItem(`saveSlot_${i}`);
        if (savedDataString) {
            const savedData = JSON.parse(savedDataString);
            slot.innerHTML = `
                <div class="aspect-video bg-gray-600 mb-2 rounded relative overflow-hidden">
                    <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-1 text-xs">
                        ${new Date(savedData.timestamp).toLocaleString()}
                    </div>
                </div>
                <div class="text-sm truncate" title="${savedData.sceneText}">${savedData.sceneText} (Scene ${savedData.sceneIndex})</div>
            `;
        } else {
            slot.innerHTML = `
                <div class="aspect-video bg-gray-800 mb-2 rounded flex items-center justify-center">
                    <i class="fas fa-save text-3xl text-gray-600"></i>
                </div>
                <div class="text-sm text-gray-400">Empty Slot</div>
            `;
        }
        
        // Add event listener for both save and load tabs' slots
        const slotInstance = slot.cloneNode(true);
        slotInstance.addEventListener('click', () => selectSaveSlot(i));
        elements.saveSlots.appendChild(slotInstance);

        const slotInstanceForLoad = slot.cloneNode(true);
        slotInstanceForLoad.addEventListener('click', () => selectSaveSlot(i));
        elements.loadSlots.appendChild(slotInstanceForLoad);
    }
}

// Select save slot
function selectSaveSlot(index) {
    // Highlight selected slot
    document.querySelectorAll('#save-slots > div, #load-slots > div').forEach((slot, i) => {
        if (i === index) {
            slot.classList.add('ring-2', 'ring-indigo-500');
        } else {
            slot.classList.remove('ring-2', 'ring-indigo-500');
        }
    });
    
    // In a real game, you'd store the selected slot index
    currentlySelectedSlot = index;
}

// Show settings modal
function showSettingsModal() {
    elements.settingsModal.classList.remove('hidden');
}

// Hide settings modal
function hideSettingsModal() {
    elements.settingsModal.classList.add('hidden');
}

// Save settings
function saveSettings() {
    alert("Settings saved!");
    hideSettingsModal();
}

// Start the game when the page loads
window.addEventListener('DOMContentLoaded', initGame);

// Gamepad Support
function initGamepad() {
    window.addEventListener('gamepadconnected', (event) => {
        console.log('Gamepad connected:', event.gamepad);
    });
    window.addEventListener('gamepaddisconnected', (event) => {
        console.log('Gamepad disconnected:', event.gamepad);
    });
    updateGamepadState(); // Start the loop
}

function updateGamepadState() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    const gamepad = gamepads[0]; // Use the first connected gamepad

    if (gamepad) {
        // Choice Navigation (D-pad Up/Down)
        if (!elements.choicesContainer.classList.contains('hidden')) {
            const choicesElements = elements.choicesContainer.children;
            if (choicesElements.length > 0) {
                let currentSelection = gameState.gamepadSelectedChoiceIndex;

                if (isGamepadButtonPressed(gamepadControls.actions.NAV_DOWN, gamepad)) {
                    if (currentSelection !== -1) {
                        choicesElements[currentSelection].classList.remove('gamepad-selected');
                    }
                    currentSelection = (currentSelection + 1) % choicesElements.length;
                    choicesElements[currentSelection].classList.add('gamepad-selected');
                    gameState.gamepadSelectedChoiceIndex = currentSelection;
                } else if (isGamepadButtonPressed(gamepadControls.actions.NAV_UP, gamepad)) {
                    if (currentSelection !== -1) {
                        choicesElements[currentSelection].classList.remove('gamepad-selected');
                    }
                    currentSelection = (currentSelection - 1 + choicesElements.length) % choicesElements.length;
                    choicesElements[currentSelection].classList.add('gamepad-selected');
                    gameState.gamepadSelectedChoiceIndex = currentSelection;
                }
            }
        }

        // Action Button (A)
        if (isGamepadButtonPressed(gamepadControls.actions.CONFIRM, gamepad)) {
            if (!elements.choicesContainer.classList.contains('hidden')) {
                if (gameState.gamepadSelectedChoiceIndex !== -1) {
                    const selectedChoiceElement = elements.choicesContainer.children[gameState.gamepadSelectedChoiceIndex];
                    if (selectedChoiceElement) {
                        selectedChoiceElement.click(); // Trigger the choice
                    }
                }
            } else {
                if (!elements.nextButton.classList.contains('hidden')) {
                    advanceStory();
                }
            }
        }

        // Update previous button states for all monitored buttons
        // The isGamepadButtonPressed function itself doesn't update prevGamepadButtonStates immediately,
        // so we need to do it here after all checks for the current frame are done.
        const buttonsToCheck = [
            gamepadControls.actions.CONFIRM,
            gamepadControls.actions.NAV_UP,
            gamepadControls.actions.NAV_DOWN
            // Add other actions if they are being actively checked in the loop
        ];
        buttonsToCheck.forEach(buttonIndex => {
            if (gamepad.buttons[buttonIndex] !== undefined) { // Ensure the button exists on the gamepad
                 prevGamepadButtonStates[buttonIndex] = gamepad.buttons[buttonIndex].pressed;
            }
        });
        
    } else {
        prevGamepadButtonStates = {}; // Clear states if no gamepad
    }

    requestAnimationFrame(updateGamepadState);
}
