import React, { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

export default function Popup() {
    const [moves, setMoves] = useState([]);
    const [url, setUrl] = useState('');
    const [pgn, setPgn] = useState('');
    const [fen, setFen] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [buttonText, setButtonText] = useState('Export PGN to Clipboard');
    const [isButtonAnimating, setIsButtonAnimating] = useState(false);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 for starting position
    const [displayFen, setDisplayFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const [predictedMove, setPredictedMove] = useState(null);
    const [isAnimatingPrediction, setIsAnimatingPrediction] = useState(false);
    const [predictionLoading, setPredictionLoading] = useState(false);
    const [boardOrientation, setBoardOrientation] = useState('white');
    const [aiExplanationEnabled, setAiExplanationEnabled] = useState(false);
    const [moveExplanation, setMoveExplanation] = useState('');
    const [highlightedSquares, setHighlightedSquares] = useState({});
    const [moveArrow, setMoveArrow] = useState(null);





    const formatExplanation = (text) => {
        if (!text) return null;

        // Split by sentences and format each one
        const sentences = text.split(/(?<=[.!?])\s+/);

        return sentences.map((sentence, index) => {
            let formattedSentence = sentence;

            // // Bold chess moves (like e4, Nf3, O-O, etc.) - FIXED the replacement string
            // formattedSentence = formattedSentence.replace(
            //     /\b([a-h][1-8]|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|O-O-?O?|\.\.\.[a-h][1-8])\b/g,
            //     '<strong>$1</strong>'
            // );

            // // Italic strategic concepts
            // formattedSentence = formattedSentence.replace(
            //     /\b(center|development|initiative|pressure|control|attack|defense|tempo|space|advantage)\b/gi,
            //     '<em>$1</em>'
            // );

            // // Highlight key evaluation words
            // formattedSentence = formattedSentence.replace(
            //     /\b(strong|weak|excellent|good|bad|poor|brilliant|mistake|blunder)\b/gi,
            //     '<span style="color: #7fb3d3; font-weight: 600;">$1</span>'
            // );

            return (
                <span key={index} dangerouslySetInnerHTML={{ __html: formattedSentence + ' ' }} />
            );
        });
    };



    const getPredictedMove = async (fen) => {
        try {
            setPredictionLoading(true);
            setMoveExplanation('');

            const endpoint = aiExplanationEnabled ?
                'http://127.0.0.1:8000/explain-move' :
                'http://127.0.0.1:8000/predict-magnus-style';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    board: fen
                })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();

            if (aiExplanationEnabled) {
                // Handle explain-move response: { "explanation": "...", "move": "e7e6" }
                setPredictedMove({
                    predicted_move: data.move,  // Use 'move' field from explain-move API
                    confidence: 0.0
                });
                setMoveExplanation(data.explanation.replace(/"/g, ''));
                return { predicted_move: data.move }; // Return in expected format
            } else {
                // Handle predict response: { "predicted_move": "h2h3", "confidence": 0.068 }
                setPredictedMove(data);
                setMoveExplanation('');
                return data;
            }

        } catch (error) {
            console.error('Error getting prediction:', error);
            setPredictedMove(null);
            setMoveExplanation('');
            return null;
        } finally {
            setPredictionLoading(false);
        }
    };

    const animatePredictedMove = (move) => {
        if (!move || isAnimatingPrediction) return;

        setIsAnimatingPrediction(true);
        const originalFen = displayFen;

        try {
            const chess = new Chess(originalFen);
            const moveResult = chess.move(move, { sloppy: true });

            if (moveResult) {
                const newFen = chess.fen();
                let animationCount = 0;
                const maxAnimations = 3;

                const animate = () => {
                    if (animationCount >= maxAnimations) {
                        setDisplayFen(originalFen);
                        setIsAnimatingPrediction(false);
                        return;
                    }

                    // Show the move
                    setDisplayFen(newFen);

                    setTimeout(() => {
                        // Return to original position
                        setDisplayFen(originalFen);
                        animationCount++;

                        setTimeout(() => {
                            animate();
                        }, 500);
                    }, 800);
                };

                animate();
            }
        } catch (error) {
            console.error('Error animating move:', error);
            setIsAnimatingPrediction(false);
        }
    };

    // Update the slider's onMouseUp and onTouchEnd events:
    const handleSliderChange = (e) => {
        setCurrentMoveIndex(parseInt(e.target.value));
    };

    const handleSliderRelease = () => {
        if (!isAnimatingPrediction) {
            getPredictedMove(displayFen).then((prediction) => {
                if (prediction && prediction.predicted_move) {
                    try {
                        const chess = new Chess(displayFen);
                        const moveResult = chess.move(prediction.predicted_move, { sloppy: true });

                        if (moveResult) {
                            setMoveArrow({
                                from: moveResult.from,
                                to: moveResult.to
                            });

                            // Highlight the destination square in red
                            setHighlightedSquares({
                            [moveResult.from]: {
                                backgroundColor: 'rgba(255, 100, 100, 0.6)',
                                border: '0px dashed #ff0000',
                            },
                            [moveResult.to]: {
                                backgroundColor: 'rgba(255, 0, 0, 0.8)',
                                border: '0px solid #ff0000',
                                boxShadow: '0 0 10px rgba(255, 0, 0, 0.5)',
                            }
                        });
                        }
                    } catch (error) {
                        console.error('Error highlighting move:', error);
                    }

                    setTimeout(() => {
                        animatePredictedMove(prediction.predicted_move);
                    }, 300);
                }
            });
        }
    };


    const convertMove = (moveData, chess) => {
        const { move, piece } = moveData;
        let fullMove = move;

        if (piece && move.includes(' ')) {
            fullMove = piece + move.replace(' ', '');
        } else if (piece) {
            fullMove = piece + move;
        }

        const legalMoves = chess.moves({ verbose: true });
        const candidates = legalMoves.filter((m) => {
            const target = move.slice(-2);
            return m.to === target && (m.san.startsWith(fullMove) || (!piece && m.piece === 'p'));
        });

        if (candidates.length === 1) {
            return candidates[0].san;
        } else if (candidates.length > 1) {
            const pieceMove = candidates.find((m) => m.piece === (piece ? piece.toLowerCase() : 'p'));
            return pieceMove ? pieceMove.san : candidates[0].san;
        }
        return null;
    };

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) {
                setError('No active tab found.');
                setLoading(false);
                return;
            }

            chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    try {
                        const moveElements = document.querySelectorAll(
                            '.timestamps-with-base-time .node-highlight-content'
                        );
                        const moves = Array.from(moveElements).map((el) => {
                            const parent = el.parentElement;
                            const isWhite = parent.classList.contains('white-move');
                            const isBlack = parent.classList.contains('black-move');
                            const figurine = el.querySelector('[data-figurine]');
                            const piece = figurine ? figurine.getAttribute('data-figurine') : '';
                            const moveText = el.textContent.trim().replace(/\s+/g, ' ').split(' ').pop();
                            console.log('Extracted:', { moveText, piece, parentClass: parent.className });

                            return {
                                move: moveText,
                                piece,
                                player: isWhite ? 'white' : isBlack ? 'black' : null,
                            };
                        }).filter((data) => data.player);

                        // Detect board orientation
                        let orientation = 'white'; // default

                        // Method 1: Check for flipped board class
                        const boardElement = document.querySelector('.board');
                        if (boardElement && boardElement.classList.contains('flipped')) {
                            orientation = 'black';
                        }

                        // Method 2: Check coordinate labels if available
                        if (orientation === 'white') {
                            const coords = document.querySelectorAll('.coordinate-light, .coordinate-dark');
                            if (coords.length > 0) {
                                // Check bottom-left coordinate - should be 'a1' for white, 'h8' for black
                                const bottomLeft = Array.from(coords).find(coord =>
                                    coord.textContent === 'a' || coord.textContent === 'h'
                                );
                                if (bottomLeft && bottomLeft.textContent === 'h') {
                                    orientation = 'black';
                                }
                            }
                        }

                        // Method 3: Check rank numbers
                        if (orientation === 'white') {
                            const rankElements = document.querySelectorAll('.rank');
                            if (rankElements.length > 0) {
                                const firstRank = rankElements[0];
                                const lastRank = rankElements[rankElements.length - 1];
                                if (firstRank.textContent === '8' || lastRank.textContent === '1') {
                                    orientation = 'black';
                                }
                            }
                        }

                        // Method 4: Check player names/avatars position
                        if (orientation === 'white') {
                            const playerSections = document.querySelectorAll('.player-section');
                            if (playerSections.length >= 2) {
                                const topPlayer = playerSections[0];
                                const bottomPlayer = playerSections[1];

                                // Look for indicators that bottom player is black
                                const bottomPlayerClasses = bottomPlayer.className;
                                if (bottomPlayerClasses.includes('black') ||
                                    bottomPlayer.querySelector('.player-color-black')) {
                                    orientation = 'black';
                                }
                            }
                        }

                        return {
                            url: window.location.href,
                            moves,
                            orientation
                        };
                    } catch (e) {
                        return {
                            url: window.location.href,
                            moves: [{ move: `ERROR: ${e.message}`, piece: '', player: null }],
                            orientation: 'white'
                        };
                    }
                },
            }, (results) => {
                if (chrome.runtime.lastError || !results || !results[0]) {
                    setError('Failed to extract moves.');
                    setMoves([]);
                    setLoading(false);
                    return;
                }

                const data = results[0].result;
                setUrl(data.url);
                setBoardOrientation(data.orientation || 'white'); // Set the detected orientation


                try {
                    const chess = new Chess();
                    const validMoves = [];
                    const invalidMoves = [];

                    for (let i = 0; i < data.moves.length; i++) {
                        const moveData = data.moves[i];
                        if (!moveData.player) {
                            invalidMoves.push({ move: moveData.move, index: i + 1 });
                            continue;
                        }

                        const expectedPlayer = i % 2 === 0 ? 'white' : 'black';
                        if (moveData.player !== expectedPlayer) {
                            invalidMoves.push({ move: moveData.move, index: i + 1 });
                            continue;
                        }

                        const convertedMove = convertMove(moveData, chess);
                        if (!convertedMove) {
                            invalidMoves.push({ move: moveData.move, index: i + 1 });
                            continue;
                        }

                        const result = chess.move(convertedMove, { sloppy: true });
                        if (result) validMoves.push(result.san);
                        else invalidMoves.push({ move: convertedMove, index: i + 1 });
                    }

                    setMoves(validMoves);
                    setPgn(chess.pgn());
                    setFen(chess.fen());
                    setLoading(false);
                    if (invalidMoves.length > 0) {
                        setError(
                            `Invalid moves: ${invalidMoves.map((m) => `${m.move} (move ${m.index})`).join(', ')}`
                        );
                    }
                } catch (e) {
                    setError(`Error processing moves: ${e.message}`);
                    setMoves([]);
                    setFen('');
                    setLoading(false);
                }
            });
        });
    }, []);

    const getFenAtMove = (moveIndex) => {
        if (moveIndex === -1) {
            return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Starting position
        }

        try {
            const chess = new Chess();
            for (let i = 0; i <= moveIndex && i < moves.length; i++) {
                chess.move(moves[i], { sloppy: true });
            }
            return chess.fen();
        } catch (e) {
            return fen; // Fallback to final position
        }
    };

    useEffect(() => {
        if (moves.length > 0) {
            setDisplayFen(getFenAtMove(currentMoveIndex));
        }
    }, [currentMoveIndex, moves]);

    useEffect(() => {
        if (moves.length > 0 && currentMoveIndex === -1) {
            setCurrentMoveIndex(moves.length - 1); // Start at final position
            setDisplayFen(fen);
        }
    }, [moves, fen]);

    const styles = {
        container: {
            width: '400px',
            minHeight: '500px',
            backgroundColor: '#1a1a1a',
            padding: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#ffffff',
        },
        header: {
            textAlign: 'center',
            marginBottom: '24px',
        },
        title: {
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 8px 0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
        },
        subtitle: {
            fontSize: '14px',
            color: '#888',
            margin: '0',
        },
        boardContainer: {
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            width: 'fit-content',
            margin: '0 auto 20px auto',
        },
        fenContainer: {
            marginTop: '16px',
            backgroundColor: '#2a2a2a',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #333',
            overflow: 'hidden',
        },
        fenLabel: {
            fontSize: '12px',
            fontWeight: '600',
            color: '#888',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        },
        fenText: {
            fontSize: '11px',
            fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
            lineHeight: '1.4',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            color: '#e0e0e0',
            margin: '0',
            width: '100%',
            boxSizing: 'border-box',
        },
        errorContainer: {
            textAlign: 'center',
            padding: '40px 20px',
        },
        errorText: {
            color: '#ff6b6b',
            fontSize: '14px',
            margin: '0',
        },
        loadingContainer: {
            textAlign: 'center',
            padding: '40px 20px',
        },
        loadingText: {
            color: '#888',
            fontSize: '14px',
            margin: '0',
        },
        spinner: {
            width: '24px',
            height: '24px',
            border: '2px solid #333',
            borderTop: '2px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px',
        },
        exportButton: {
            width: '100%',
            padding: '12px 16px',
            marginTop: '16px',
            backgroundColor: '#667eea',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
        },
        moveNavigation: {
            marginTop: '16px',
            backgroundColor: '#2a2a2a',
            borderRadius: '12px',
            padding: '12px',
            border: '1px solid #333',
        },
        moveNavLabel: {
            fontSize: '12px',
            fontWeight: '600',
            color: '#888',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        },
        moveSlider: {
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            backgroundColor: '#444',
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
            marginBottom: '8px',
        },
        moveInfo: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#888',
        },
        moveCounter: {
            color: '#e0e0e0',
        },
        navButtons: {
            display: 'flex',
            gap: '8px',
        },
        navButton: {
            padding: '4px 8px',
            backgroundColor: '#444',
            color: '#e0e0e0',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
        },

        predictionInfo: {
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#333',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        predictionMove: {
            fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
            color: '#667eea',
            fontWeight: '600',
        },
        predictionConfidence: {
            color: '#888',
        },
        predictionLoading: {
            color: '#888',
            fontStyle: 'italic',
        },

        toggleContainer: {
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            border: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        toggleLabel: {
            fontSize: '14px',
            color: '#e0e0e0',
            fontWeight: '500',
        },
        toggleSwitch: {
            position: 'relative',
            width: '50px',
            height: '24px',
            backgroundColor: aiExplanationEnabled ? '#667eea' : '#444',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            border: 'none',
            outline: 'none',
        },
        toggleSlider: {
            position: 'absolute',
            top: '2px',
            left: aiExplanationEnabled ? '26px' : '2px',
            width: '20px',
            height: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            transition: 'left 0.3s ease',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        },
        explanationContainer: {
            marginTop: '8px',
            padding: '16px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            border: '1px solid #333',
        },
        explanationHeader: {
            fontSize: '12px',
            fontWeight: '600',
            color: '#667eea',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
        },
        explanationText: {
            fontSize: '13px',
            lineHeight: '1.6',
            color: '#e0e0e0',
            margin: '0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },

    };


    const spinnerKeyframes = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

    return (
        <>
            <style>{spinnerKeyframes}</style>
            <div style={styles.container}>
                <div style={styles.header}>
                    <h1 style={styles.title}>WW?D</h1>
                    <p style={styles.subtitle}>Magnus Carlsen</p>
                </div>

                {loading ? (
                    <div style={styles.loadingContainer}>
                        <div style={styles.spinner}></div>
                        <p style={styles.loadingText}>Analyzing position...</p>
                    </div>
                ) : error ? (
                    <div style={styles.errorContainer}>
                        <p style={styles.errorText}>{error}</p>
                    </div>
                ) : fen ? (
                    <>
                        {/* AI Explanation Toggle */}
                        <div style={styles.toggleContainer}>
                            <span style={styles.toggleLabel}>AI Explanation</span>
                            <button
                                style={styles.toggleSwitch}
                                onClick={() => setAiExplanationEnabled(!aiExplanationEnabled)}
                            >
                                <div style={styles.toggleSlider}></div>
                            </button>
                        </div>

                        <div style={styles.boardContainer}>
                        <Chessboard
    position={displayFen}
    arePiecesDraggable={false}
    boardWidth={352}
    customDarkSquareStyle={{ backgroundColor: '#2d4a66' }}
    customLightSquareStyle={{ backgroundColor: '#7fb3d3' }}
    animationDuration={200}
    boardOrientation={boardOrientation}
    customSquareStyles={highlightedSquares}
    customArrows={moveArrow ? [[moveArrow.from, moveArrow.to, 'red']] : []}
/>
                        </div>

                        {moves.length > 0 && (
                            <div style={styles.moveNavigation}>
                                <div style={styles.moveNavLabel}>Game Navigation</div>
                                <input
                                    type="range"
                                    min="-1"
                                    max={moves.length - 1}
                                    value={currentMoveIndex}
                                    onChange={handleSliderChange}
                                    onMouseUp={handleSliderRelease}
                                    onTouchEnd={handleSliderRelease}
                                    style={{
                                        ...styles.moveSlider,
                                        opacity: isAnimatingPrediction || predictionLoading ? 0.5 : 1,
                                        cursor: isAnimatingPrediction || predictionLoading ? 'not-allowed' : 'pointer',
                                    }}
                                    disabled={isAnimatingPrediction || predictionLoading}
                                />

                                <div style={styles.moveInfo}>
                                    <span style={styles.moveCounter}>
                                        Move: {currentMoveIndex === -1 ? 'Start' : `${currentMoveIndex + 1}/${moves.length}`}
                                        {currentMoveIndex >= 0 && moves[currentMoveIndex] && ` - ${moves[currentMoveIndex]}`}
                                    </span>
                                    <div style={styles.navButtons}>
                                        {/* Your existing navigation buttons */}
                                    </div>
                                </div>

                                {/* Prediction display */}
                                {(predictedMove || predictionLoading) && (
                                    <div style={styles.predictionInfo}>
                                        {predictionLoading ? (
                                            <span style={styles.predictionLoading}>
                                                {aiExplanationEnabled ? 'Getting AI explanation...' : 'Getting AI prediction...'}
                                            </span>
                                        ) : predictedMove ? (
                                            <>
                                                <span>
                                                    {aiExplanationEnabled ? 'Recommended' : 'Predicted'}:
                                                    <span style={styles.predictionMove}>{predictedMove.predicted_move}</span>
                                                </span>
                                                {!aiExplanationEnabled && predictedMove.confidence && (
                                                    <span style={styles.predictionConfidence}>
                                                        {(predictedMove.confidence).toFixed(1)}%
                                                    </span>
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                )}

                                {/* AI Explanation display */}
                                {aiExplanationEnabled && moveExplanation && (
                                    <div style={styles.explanationContainer}>
                                        <div style={styles.explanationHeader}>AI Analysis</div>
                                        <div style={styles.explanationText}>
                                            {formatExplanation(moveExplanation)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={styles.fenContainer}>
                            <div style={styles.fenLabel}>FEN Notation</div>
                            <pre style={styles.fenText}>{displayFen}</pre>
                        </div>

                        <button
                            style={{
                                ...styles.exportButton,
                                backgroundColor: isButtonAnimating ? '#4caf50' : '#667eea',
                                transform: isButtonAnimating ? 'scale(0.95)' : 'scale(1)',
                            }}
                            onClick={() => {
                                navigator.clipboard.writeText(pgn).then(() => {
                                    setButtonText('Copied!');
                                    setIsButtonAnimating(true);

                                    setTimeout(() => {
                                        setButtonText('Export PGN to Clipboard');
                                        setIsButtonAnimating(false);
                                    }, 1500);
                                }).catch(err => {
                                    console.error('Failed to copy PGN:', err);
                                    setButtonText('Copy Failed');
                                    setIsButtonAnimating(true);

                                    setTimeout(() => {
                                        setButtonText('Export PGN to Clipboard');
                                        setIsButtonAnimating(false);
                                    }, 1500);
                                });
                            }}
                        >
                            {buttonText}
                        </button>
                    </>
                ) : (
                    <div style={styles.errorContainer}>
                        <p style={styles.errorText}>No position to display</p>
                    </div>
                )}
            </div>
        </>
    );
}