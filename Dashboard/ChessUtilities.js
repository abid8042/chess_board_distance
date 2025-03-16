/**
 * ChessUtilities.js
 * Utility functions for chess-related operations.
 */

const ChessUtilities = (function() {
    // Private variables and methods
    
    // Piece symbols mapping
    const pieceSymbols = {
        'k': { type: 'king', color: 'black' },
        'q': { type: 'queen', color: 'black' },
        'r': { type: 'rook', color: 'black' },
        'b': { type: 'bishop', color: 'black' },
        'n': { type: 'knight', color: 'black' },
        'p': { type: 'pawn', color: 'black' },
        'K': { type: 'king', color: 'white' },
        'Q': { type: 'queen', color: 'white' },
        'R': { type: 'rook', color: 'white' },
        'B': { type: 'bishop', color: 'white' },
        'N': { type: 'knight', color: 'white' },
        'P': { type: 'pawn', color: 'white' }
    };
    
    // Square colors
    const squareColors = {};
    
    // Initialize square colors
    (function initSquareColors() {
        const files = 'abcdefgh';
        const ranks = '12345678';
        
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = files[i] + ranks[j];
                const isLightSquare = (i + j) % 2 === 0;
                squareColors[square] = isLightSquare ? 'light' : 'dark';
            }
        }
    })();
    
    /**
     * Parses a FEN string and returns the board position
     * 
     * @param {string} fen - The FEN string
     * @returns {Object} - Object with piece placement info
     */
    function parseFEN(fen) {
        if (!fen) return null;
        
        // Split FEN parts
        const parts = fen.trim().split(' ');
        const piecePlacement = parts[0];
        const activeColor = parts[1];
        const castling = parts[2];
        const enPassant = parts[3];
        const halfMoveClock = parseInt(parts[4]) || 0;
        const fullMoveNumber = parseInt(parts[5]) || 1;
        
        // Parse piece placement
        const ranks = piecePlacement.split('/');
        const board = {};
        
        for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
            const rankData = ranks[7 - rankIndex]; // FEN starts from rank 8
            let fileIndex = 0;
            
            for (let i = 0; i < rankData.length; i++) {
                const char = rankData[i];
                
                if (/\d/.test(char)) {
                    // Skip empty squares
                    fileIndex += parseInt(char);
                } else {
                    // Place piece
                    const file = 'abcdefgh'[fileIndex];
                    const rank = (rankIndex + 1).toString();
                    const square = file + rank;
                    
                    board[square] = {
                        square,
                        piece: char,
                        pieceType: pieceSymbols[char]?.type || null,
                        pieceColor: pieceSymbols[char]?.color || null,
                        squareColor: squareColors[square]
                    };
                    
                    fileIndex++;
                }
            }
        }
        
        return {
            board,
            activeColor,
            castling,
            enPassant,
            halfMoveClock,
            fullMoveNumber
        };
    }
    
    /**
     * Finds a piece by its attributes
     * 
     * @param {Array} pieces - Array of piece objects
     * @param {Object} attributes - Attributes to match
     * @returns {Object|null} - The matching piece or null
     */
    function findPiece(pieces, attributes) {
        if (!pieces || !attributes) return null;
        
        return pieces.find(piece => {
            // Check all attributes
            for (const [key, value] of Object.entries(attributes)) {
                if (piece[key] !== value) return false;
            }
            return true;
        });
    }
    
    /**
     * Counts pieces by type and color
     * 
     * @param {Array} pieces - Array of piece objects
     * @returns {Object} - Counts of pieces by type and color
     */
    function countPieces(pieces) {
        if (!pieces) return {};
        
        const counts = {
            white: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0, total: 0 },
            black: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0, total: 0 },
            total: 0
        };
        
        pieces.forEach(piece => {
            if (piece.status === 'active' && piece.color && piece.type) {
                counts[piece.color][piece.type]++;
                counts[piece.color].total++;
                counts.total++;
            }
        });
        
        return counts;
    }
    
    /**
     * Generates an array of all chess squares
     * 
     * @returns {Array} - Array of square names
     */
    function getAllSquares() {
        const squares = [];
        const files = 'abcdefgh';
        const ranks = '12345678';
        
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                squares.push(files[i] + ranks[j]);
            }
        }
        
        return squares;
    }
    
    /**
     * Gets the color of a square
     * 
     * @param {string} square - The square name (e.g., 'e4')
     * @returns {string} - 'light' or 'dark'
     */
    function getSquareColor(square) {
        return squareColors[square] || null;
    }
    
    /**
     * Converts algebraic notation to board coordinates
     * 
     * @param {string} square - The square name (e.g., 'e4')
     * @returns {Object} - The coordinates {x, y} (0-7)
     */
    function squareToCoords(square) {
        if (!square || square.length !== 2) return null;
        
        const file = square.charAt(0).toLowerCase();
        const rank = square.charAt(1);
        
        const x = 'abcdefgh'.indexOf(file);
        const y = parseInt(rank) - 1;
        
        if (x === -1 || y < 0 || y > 7) return null;
        
        return { x, y };
    }
    
    /**
     * Converts board coordinates to algebraic notation
     * 
     * @param {number} x - The file coordinate (0-7)
     * @param {number} y - The rank coordinate (0-7)
     * @returns {string} - The square name
     */
    function coordsToSquare(x, y) {
        if (x < 0 || x > 7 || y < 0 || y > 7) return null;
        
        const file = 'abcdefgh'[x];
        const rank = (y + 1).toString();
        
        return file + rank;
    }
    
    /**
     * Parses a move in Standard Algebraic Notation (SAN)
     * 
     * @param {string} san - The move in SAN
     * @returns {Object} - Parsed move information
     */
    function parseSAN(san) {
        if (!san) return null;
        
        // Special cases
        if (san === 'O-O') {
            return { castling: 'kingside' };
        }
        
        if (san === 'O-O-O') {
            return { castling: 'queenside' };
        }
        
        // Regular moves
        const match = san.match(/^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([NBRQ]))?([+#])?$/);
        
        if (match) {
            const [, piece, srcFile, srcRank, capture, target, promotion, check] = match;
            
            return {
                piece: piece || 'P',
                sourceFile: srcFile,
                sourceRank: srcRank,
                capture: !!capture,
                target,
                promotion,
                check: check === '+',
                checkmate: check === '#'
            };
        }
        
        return null;
    }
    
    /**
     * Calculates the Manhattan distance between two squares
     * 
     * @param {string} square1 - The first square
     * @param {string} square2 - The second square
     * @returns {number} - The Manhattan distance
     */
    function squareDistance(square1, square2) {
        const coords1 = squareToCoords(square1);
        const coords2 = squareToCoords(square2);
        
        if (!coords1 || !coords2) return null;
        
        return Math.abs(coords1.x - coords2.x) + Math.abs(coords1.y - coords2.y);
    }
    
    /**
     * Checks if a square is a border square
     * 
     * @param {string} square - The square to check
     * @returns {boolean} - Whether it's a border square
     */
    function isBorderSquare(square) {
        if (!square || square.length !== 2) return false;
        
        const file = square.charAt(0);
        const rank = square.charAt(1);
        
        return file === 'a' || file === 'h' || rank === '1' || rank === '8';
    }
    
    /**
     * Gets the center distance of a square
     * 
     * @param {string} square - The square to check
     * @returns {number} - The center distance (0-6)
     */
    function centerDistance(square) {
        const coords = squareToCoords(square);
        if (!coords) return null;
        
        // Distance from the center 3.5, 3.5
        const centerX = 3.5;
        const centerY = 3.5;
        
        return Math.max(
            Math.abs(coords.x - centerX),
            Math.abs(coords.y - centerY)
        );
    }
    
    /**
     * Validates and normalizes piece data for visualization
     * 
     * @param {Array} nodes - Array of node objects
     * @returns {Array} - The nodes with validated piece data
     */
    function validatePieceData(nodes) {
        if (!nodes || !Array.isArray(nodes)) return [];
        
        return nodes.map(node => {
            if (!node) return node;
            
            // Ensure has_piece flag is correct
            if (node.piece_type || node.piece_symbol || node.piece_color) {
                node.has_piece = true;
            }
            
            // Only process nodes with pieces
            if (node.has_piece) {
                // Normalize piece type (lowercase for consistency)
                if (node.piece_type !== undefined && node.piece_type !== null) {
                    // Convert to string first to handle numeric values
                    node.piece_type = String(node.piece_type).toLowerCase();
                } else if (node.piece_symbol) {
                    // Derive piece type from symbol if needed
                    const symbol = String(node.piece_symbol).toLowerCase();
                    const typeMap = {
                        'p': 'pawn',
                        'n': 'knight',
                        'b': 'bishop',
                        'r': 'rook',
                        'q': 'queen',
                        'k': 'king'
                    };
                    node.piece_type = typeMap[symbol] || 'pawn';
                }
                
                // Ensure piece color is set correctly
                if (!node.piece_color && node.piece_symbol) {
                    // Determine color from symbol (uppercase = white, lowercase = black)
                    const pieceSymbol = String(node.piece_symbol);
                    node.piece_color = pieceSymbol === pieceSymbol.toUpperCase() ? 'white' : 'black';
                }
                
                // Set default values if still missing
                if (!node.piece_type) {
                    console.warn(`Missing piece type for node ${node.id}`);
                    node.piece_type = 'pawn';
                }
                
                if (!node.piece_color) {
                    console.warn(`Missing piece color for node ${node.id}`);
                    node.piece_color = 'white';
                }
            }
            
            return node;
        });
    }
    
    /**
     * Enhances node data with data attributes for easier CSS targeting
     * 
     * @param {Array} nodes - Array of node objects
     * @returns {Array} - Nodes with enhanced data attributes
     */
    function addNodeDataAttributes(nodes) {
        if (!nodes || !Array.isArray(nodes)) return [];
        
        return nodes.map(node => {
            if (!node) return node;
            
            // Create data attribute object if it doesn't exist
            node.data = node.data || {};
            
            // Add chess-specific data attributes
            if (node.has_piece) {
                node.data['piece-color'] = node.piece_color;
                node.data['piece-type'] = node.piece_type;
            }
            
            // Add network-specific data attributes
            node.data['community'] = node.community_id;
            node.data['component'] = node.component_id;
            
            return node;
        });
    }
    
    // Public API
    return {
        parseFEN,
        findPiece,
        countPieces,
        getAllSquares,
        getSquareColor,
        squareToCoords,
        coordsToSquare,
        parseSAN,
        squareDistance,
        isBorderSquare,
        centerDistance,
        validatePieceData,
        addNodeDataAttributes
    };
})();