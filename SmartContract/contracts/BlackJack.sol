// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract Blackjack {

    enum GameState {
        Idle,
        PlayerTurn,
        DealerTurn,
        Finished
    }

    enum GameResult {
        None,
        PlayerWin,
        DealerWin,
        Push
    }

    address public immutable owner;
    address public player;

    uint256 public bet;

    uint256 public playerScore;
    uint256 public dealerScore;

    uint256[] public playerCards;
    uint256[] public dealerCards;

    GameState public gameState;
    GameResult public gameResult;

    event GameStarted(address indexed player, uint256 bet);
    event PlayerHit(uint256 card, uint256 total);
    event DealerHit(uint256 card, uint256 total);
    event GameFinished(address indexed player, GameResult result);
    event Payout(address indexed player, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyPlayer() {
        require(msg.sender == player, "Only player");
        _;
    }

    modifier inState(GameState state) {
        require(gameState == state, "Invalid game state");
        _;
    }

    constructor() {
        owner = msg.sender;
        gameState = GameState.Idle;
    }

    // view
    function getPlayerCards() external view returns (uint256[] memory) {
        return playerCards;
    }

    function getDealerCards() external view returns (uint256[] memory) {
        return dealerCards;
    }

    // Unreal blackjack logic 777
    function startGame() external payable inState(GameState.Idle) {
        require(msg.value > 0, "Bet required");

        _resetGame();

        player = msg.sender;
        bet = msg.value;

        _dealPlayer();
        _dealPlayer();

        _dealDealer();
        _dealDealer();

        gameState = GameState.PlayerTurn;
        gameResult = GameResult.None;

        emit GameStarted(player, bet);
    }

    function hit() external onlyPlayer inState(GameState.PlayerTurn) {
        uint256 card = _dealPlayer();
        emit PlayerHit(card, playerScore);

        if (playerScore > 21) {
            gameResult = GameResult.DealerWin;
            gameState = GameState.Finished;
            emit GameFinished(player, gameResult);
        }
    }

    function stand() external onlyPlayer inState(GameState.PlayerTurn) {
        gameState = GameState.DealerTurn;

        while (dealerScore < 17) {
            uint256 card = _dealDealer();
            emit DealerHit(card, dealerScore);
        }

        if (dealerScore > 21 || playerScore > dealerScore) {
            gameResult = GameResult.PlayerWin;
        } else if (playerScore == dealerScore) {
            gameResult = GameResult.Push;
        } else {
            gameResult = GameResult.DealerWin;
        }

        gameState = GameState.Finished;
        emit GameFinished(player, gameResult);
    }

    function payout() external onlyPlayer inState(GameState.Finished) {
        require(bet > 0, "Already paid");

        uint256 amount = bet;
        bet = 0;
        if (gameResult == GameResult.PlayerWin) {
            uint256 payoutAmount = amount * 2;
            payable(player).transfer(payoutAmount);
            emit Payout(player, payoutAmount);
        } else if (gameResult == GameResult.Push) {
            payable(player).transfer(amount);
            emit Payout(player, amount);
        }
    }

    function _resetGame() internal {
        delete playerCards;
        delete dealerCards;

        playerScore = 0;
        dealerScore = 0;

        bet = 0;
        player = address(0);
    }

    function resetGame() external inState(GameState.Finished) {
        _resetGame();
        gameState = GameState.Idle;
        gameResult = GameResult.None;
    }

    function _dealPlayer() internal returns (uint256) {
        uint256 card = _randomCard();
        playerCards.push(card);
        playerScore = _calculateScore(playerCards);
        return card;
    }

    function _dealDealer() internal returns (uint256) {
        uint256 card = _randomCard();
        dealerCards.push(card);
        dealerScore = _calculateScore(dealerCards);
        return card;
    }

    function _randomCard() internal view returns (uint256) {
        return (
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.timestamp,
                        block.prevrandao,
                        playerCards.length,
                        dealerCards.length
                    )
                )
            ) % 13
        ) + 1;
    }

    // Расчет туза
    function _calculateScore(uint256[] memory cards) internal pure returns (uint256) {
        uint256 score = 0;
        uint256 aces = 0;

        for (uint256 i = 0; i < cards.length; i++) {
            uint256 card = cards[i];

            if (card == 1) {
                aces++;
                score += 11;
            } else if (card >= 11) {
                score += 10;
            } else {
                score += card;
            }
        }

        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }

        return score;
    }
}