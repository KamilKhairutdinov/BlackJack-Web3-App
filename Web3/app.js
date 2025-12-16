const CONTRACT_ADDRESS = '0xc55A8A148D768A315b21ec8a321E59d46AE5dA72';
const CONTRACT_ABI = [
    "event GameStarted(address indexed player, uint256 bet)",
    "event PlayerHit(uint256 card, uint256 total)",
    "event DealerHit(uint256 card, uint256 total)",
    "event GameFinished(address indexed player, uint8 result)",
    "event Payout(address indexed player, uint256 amount)",
    "function startGame() payable",
    "function hit()",
    "function stand()",
    "function payout()",
    "function resetGame()",
    "function getPlayerCards() view returns (uint256[])",
    "function getDealerCards() view returns (uint256[])",
    "function playerScore() view returns (uint256)",
    "function dealerScore() view returns (uint256)",
    "function gameState() view returns (uint8)",
    "function gameResult() view returns (uint8)",
    "function bet() view returns (uint256)",
    "function player() view returns (address)"
];

let provider;
let signer;
let contract;
let account;
let network;

const GAME_STATES = {
    0: 'Idle ⏸️',
    1: 'Your Turn 🎮',
    2: 'Dealer Turn 🏦',
    3: 'Finished ✅'
};

const GAME_RESULTS = {
    0: 'None',
    1: '🎉 You Win!',
    2: '😞 Dealer Wins',
    3: '🤝 Push'
};

const CARD_NAMES = {
    1: 'A',
    2: '2',
    3: '3',
    4: '4',
    5: '5',
    6: '6',
    7: '7',
    8: '8',
    9: '9',
    10: '10',
    11: 'J',
    12: 'Q',
    13: 'K'
};

// DOM 
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const walletInfo = document.getElementById('walletInfo');
const accountSpan = document.getElementById('account');
const balanceSpan = document.getElementById('balance');
const statusDiv = document.getElementById('statusText');
const networkInfo = document.getElementById('networkInfo');
const gameArea = document.getElementById('gameArea');
const installMeta = document.getElementById('installMetaMask');
const betAmountInput = document.getElementById('betAmount');
const startGameBtn = document.getElementById('startGameBtn');
const stateText = document.getElementById('stateText');
const resultText = document.getElementById('resultText');
const playerScoreSpan = document.getElementById('playerScore');
const dealerScoreSpan = document.getElementById('dealerScore');
const playerCardsDiv = document.getElementById('playerCards');
const dealerCardsDiv = document.getElementById('dealerCards');
const hitBtn = document.getElementById('hitBtn');
const standBtn = document.getElementById('standBtn');
const payoutBtn = document.getElementById('payoutBtn');
const resetBtn = document.getElementById('resetBtn');
const transactionStatus = document.getElementById('transactionStatus');

async function checkMetaMask() {
    if (typeof window.ethereum === 'undefined') {
        installMeta.classList.remove('hidden');
        connectBtn.classList.add('hidden');
        statusDiv.textContent = 'MetaMask not detected';
        return false;
    }
    
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
        await connectWallet();
    }
    
    return true;
}

async function connectWallet() {
    try {
        if (!window.ethereum) {
            throw new Error('Please install MetaMask!');
        }
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        account = await signer.getAddress();
        network = await provider.getNetwork();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        await updateWalletUI();
        
        setupEventListeners();
        
        await updateGameState();
        
        return true;
        
    } catch (error) {
        console.error('Connection error:', error);
        showError(`Connection failed: ${error.message}`);
        return false;
    }
}

function disconnectWallet() {
    provider = null;
    signer = null;
    contract = null;
    account = null;
    
    connectBtn.classList.remove('hidden');
    walletInfo.classList.add('hidden');
    gameArea.classList.add('hidden');
    statusDiv.textContent = 'Wallet disconnected. Connect to play.';
    
    resetGameUI();
}

async function updateWalletUI() {
    if (!account) return;
    
    accountSpan.textContent = `${account.substring(0, 6)}...${account.substring(38)}`;
    
    try {
        const balance = await provider.getBalance(account);
        balanceSpan.textContent = ethers.formatEther(balance).substring(0, 7);
    } catch (error) {
        console.error('Failed to get balance:', error);
    }
    
    networkInfo.textContent = `Network: ${network.name} (Chain ID: ${network.chainId})`;
    networkInfo.classList.remove('hidden');
    
    connectBtn.classList.add('hidden');
    walletInfo.classList.remove('hidden');
    gameArea.classList.remove('hidden');
    installMeta.classList.add('hidden');
    
    statusDiv.textContent = '✅ Connected to MetaMask';
    statusDiv.style.color = '#4ecdc4';
}

function setupEventListeners() {
    if (!window.ethereum) return;
    
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            disconnectWallet();
        } else {
            location.reload();
        }
    });
    
    window.ethereum.on('chainChanged', () => {
        location.reload();
    });
    
    if (contract) {
        contract.removeAllListeners();
        
        contract.on('GameStarted', async (player, bet) => {
            console.log('GameStarted event:', player, bet);
            showTransaction('Game started! Bet: ' + ethers.formatEther(bet) + ' ETH');
            await updateGameState();
        });
        
        contract.on('PlayerHit', async (card, total) => {
            console.log('PlayerHit event:', card, total);
            showTransaction(`You drew: ${CARD_NAMES[card] || card}`);
            await updateGameState();
            
            if (total > 21) {
                showError('Bust! You went over 21.');
                setTimeout(async () => {
                    await updateGameState();
                }, 1000);
            }
        });
        
        contract.on('DealerHit', async (card, total) => {
            console.log('DealerHit event:', card, total);
            showTransaction(`Dealer drew: ${CARD_NAMES[card] || card}`);
            await updateGameState();
        });
        
        contract.on('GameFinished', async (player, result) => {
            console.log('GameFinished event:', player, result);
            const resultText = GAME_RESULTS[result] || 'Unknown';
            showTransaction(`Game finished! Result: ${resultText}`);
            await updateGameState();
            
            const resultNum = Number(result);
            if (resultNum === 1) {
                showCelebration('🎉 You Win!');
            } else if (resultNum === 2) {
                showError('Dealer wins 😞');
            } else if (resultNum === 3) {
                showTransaction('Push! It\'s a tie.');
            }
        });
        
        contract.on('Payout', async (player, amount) => {
            console.log('Payout event:', player, amount);
            showTransaction(`🎊 Payout received: ${ethers.formatEther(amount)} ETH`);
            await updateGameState();
            await updateWalletUI();
        });
    }
}

async function updateGameState() {
    if (!contract) return;
    
    try {
        const [currentState, result, pScore, dScore, currentBet, currentPlayer] = await Promise.all([
            contract.gameState(),
            contract.gameResult(),
            contract.playerScore(),
            contract.dealerScore(),
            contract.bet(),
            contract.player()
        ]);
        
        console.log('Game state:', {
            state: currentState,
            result: result,
            playerScore: pScore,
            dealerScore: dScore,
            bet: currentBet,
            player: currentPlayer
        });
        
        const stateNum = Number(currentState);
        const resultNum = Number(result);
        const playerScoreNum = Number(pScore);
        const dealerScoreNum = Number(dScore);
        const betNum = Number(currentBet);
        
        stateText.textContent = `Game State: ${GAME_STATES[stateNum] || stateNum}`;
        resultText.textContent = `Result: ${GAME_RESULTS[resultNum] || resultNum}`;
        playerScoreSpan.textContent = playerScoreNum.toString();
        dealerScoreSpan.textContent = dealerScoreNum.toString();
        
        const playerCards = await contract.getPlayerCards();
        const dealerCards = await contract.getDealerCards();
        
        const playerCardsNum = playerCards.map(card => Number(card));
        const dealerCardsNum = dealerCards.map(card => Number(card));
        
        displayCards(playerCardsDiv, playerCardsNum, 'player');
        displayCards(dealerCardsDiv, dealerCardsNum, 'dealer', stateNum);
        
        updateButtons(stateNum, resultNum, currentPlayer);
        
        updateStatus(stateNum, resultNum);
        
        if (stateNum === 3) {
            showGameResult(resultNum, playerScoreNum, dealerScoreNum);
        }
        
    } catch (error) {
        console.error('Update game state error:', error);
        showError(`Failed to update game state: ${error.message}`);
    }
}

function displayCards(container, cards, playerType, gameState = 0) {
    container.innerHTML = '';
    
    if (!cards || cards.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = 'No cards yet';
        emptyMsg.style.color = '#666';
        container.appendChild(emptyMsg);
        return;
    }
    
    cards.forEach((cardValue, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        
        if (playerType === 'dealer' && index === 0 && gameState === 1) {
            cardDiv.classList.add('dealer-hidden');
            cardDiv.textContent = '?';
        } else {
            const cardName = CARD_NAMES[cardValue] || cardValue.toString();
            cardDiv.textContent = cardName;
            
            const isRed = [1, 3, 5, 7, 9, 11, 13].includes(Number(cardValue));
            cardDiv.classList.add(isRed ? 'red' : 'black');
        }
        
        container.appendChild(cardDiv);
    });
}

function updateButtons(gameState, result, currentPlayer) {
    hitBtn.classList.add('hidden');
    standBtn.classList.add('hidden');
    payoutBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
    startGameBtn.disabled = false;
    
    const isPlayer = account && currentPlayer.toLowerCase() === account.toLowerCase();
    
    switch (gameState) {
        case 0: // Idle
            startGameBtn.classList.remove('hidden');
            resetBtn.classList.add('hidden');
            break;
            
        case 1: // Player Turn
            hitBtn.classList.remove('hidden');
            standBtn.classList.remove('hidden');
            startGameBtn.disabled = true;
            break;
            
        case 2: // Dealer Turn
            startGameBtn.disabled = true;
            break;
            
        case 3: // Finished
            if (isPlayer && (result == 1 || result == 3)) {
                payoutBtn.classList.remove('hidden');
            }
            resetBtn.classList.remove('hidden');
            startGameBtn.classList.remove('hidden');
            break;
    }
}

function updateStatus(gameState, result) {
    switch (gameState) {
        case 0:
            statusDiv.textContent = '🎯 Ready to play! Place your bet.';
            statusDiv.style.color = '#4ecdc4';
            break;
        case 1:
            statusDiv.textContent = '🎮 Your turn! Hit or Stand?';
            statusDiv.style.color = '#ffd700';
            break;
        case 2:
            statusDiv.textContent = '🏦 Dealer is playing...';
            statusDiv.style.color = '#ff9800';
            break;
        case 3:
            const resultText = GAME_RESULTS[result];
            statusDiv.textContent = resultText;
            if (result == 1) {
                statusDiv.style.color = '#43e97b';
            } else if (result == 2) {
                statusDiv.style.color = '#ff6b6b';
            } else {
                statusDiv.style.color = '#ffd700';
            }
            break;
    }
}

function showGameResult(result, playerScore, dealerScore) {
    let resultMessage = '';
    let resultClass = '';
    
    switch (result) {
        case 1: // Player Win
            resultMessage = `🎉 You Win! ${playerScore} vs ${dealerScore}`;
            resultClass = 'win';
            break;
        case 2: // Dealer Win
            resultMessage = `😞 Dealer Wins! ${dealerScore} vs ${playerScore}`;
            if (playerScore > 21) {
                resultMessage += ' (Bust!)';
            }
            resultClass = 'lose';
            break;
        case 3: // Push
            resultMessage = `🤝 Push! ${playerScore} vs ${dealerScore}`;
            resultClass = 'push';
            break;
    }
    
    let resultElement = document.getElementById('gameResultDisplay');
    if (!resultElement) {
        resultElement = document.createElement('div');
        resultElement.id = 'gameResultDisplay';
        resultElement.className = 'game-result';
        document.querySelector('.game-state').appendChild(resultElement);
    }
    
    resultElement.innerHTML = `
        <h4 class="${resultClass}">${resultMessage}</h4>
        ${result === 1 ? '<p>🎊 Click "Claim Winnings" to get your payout!</p>' : ''}
    `;
    
    resultElement.classList.remove('hidden');
}

function showCelebration(message) {
    console.log('Celebration:', message);
    
    const gameArea = document.getElementById('gameArea');
    gameArea.classList.add('celebrate');
    
    setTimeout(() => {
        gameArea.classList.remove('celebrate');
    }, 2000);
}

function resetGameUI() {
    playerCardsDiv.innerHTML = '';
    dealerCardsDiv.innerHTML = '';
    playerScoreSpan.textContent = '0';
    dealerScoreSpan.textContent = '0';
    stateText.textContent = 'Game State: Idle';
    resultText.textContent = 'Result: None';
    betAmountInput.value = '0.01';
    transactionStatus.classList.add('hidden');
    
    const resultElement = document.getElementById('gameResultDisplay');
    if (resultElement) {
        resultElement.classList.add('hidden');
    }
}

function showTransaction(message) {
    transactionStatus.textContent = message;
    transactionStatus.classList.remove('hidden');
    setTimeout(() => {
        transactionStatus.classList.add('hidden');
    }, 5000);
}

function showError(message) {
    statusDiv.textContent = `❌ ${message}`;
    statusDiv.style.color = '#ff6b6b';
    setTimeout(() => {
        updateStatusFromContract();
    }, 3000);
}

async function updateStatusFromContract() {
    if (!contract) return;
    try {
        const currentState = await contract.gameState();
        const result = await contract.gameResult();
        updateStatus(Number(currentState), Number(result));
    } catch (error) {
        console.error('Failed to update status:', error);
    }
}


async function init() {
    await checkMetaMask();

    connectBtn.addEventListener('click', connectWallet);
    disconnectBtn.addEventListener('click', disconnectWallet);
    
    startGameBtn.addEventListener('click', async () => {
        try {
            const betAmount = ethers.parseEther(betAmountInput.value);
            showTransaction('Starting game...');
            
            const tx = await contract.startGame({ value: betAmount });
            await tx.wait();
            
            showTransaction('Game started successfully!');
            await updateGameState(); 
            
        } catch (error) {
            console.error('Start game error:', error);
            showError(`Failed to start game: ${error.message}`);
        }
    });
    
    hitBtn.addEventListener('click', async () => {
        try {
            showTransaction('Taking a card...');
            const tx = await contract.hit();
            await tx.wait();
            
            await updateGameState();
            
        } catch (error) {
            console.error('Hit error:', error);
            showError(`Failed to hit: ${error.message}`);
        }
    });
    
    standBtn.addEventListener('click', async () => {
        try {
            showTransaction('Standing...');
            const tx = await contract.stand();
            await tx.wait();
            
            await updateGameState();
            
        } catch (error) {
            console.error('Stand error:', error);
            showError(`Failed to stand: ${error.message}`);
        }
    });

    payoutBtn.addEventListener('click', async () => {
        try {
            showTransaction('Claiming winnings...');
            const tx = await contract.payout();
            await tx.wait();
            
            await updateWalletUI();
            await updateGameState();
            
        } catch (error) {
            console.error('Payout error:', error);
            showError(`Failed to claim: ${error.message}`);
        }
    });
    
    resetBtn.addEventListener('click', async () => {
        try {
            showTransaction('Resetting game...');
            const tx = await contract.resetGame();
            await tx.wait();
            
            await updateGameState();
            
        } catch (error) {
            console.error('Reset error:', error);
            showError(`Failed to reset: ${error.message}`);
        }
    });
}

window.addEventListener('load', init);