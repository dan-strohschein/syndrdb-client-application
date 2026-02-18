/**
 * Enhanced Tokenizer for SyndrQL Language Service V2
 * Provides character-by-character scanning with proper handling of strings, comments, and position tracking
 */

import { TokenType } from './token_types';

export interface Token {
    Type: TokenType;
    Value: string;
    Literal: any;
    Line: number;
    Column: number;
    StartPosition: number;
    EndPosition: number;
}

export interface TokenPosition {
    line: number;
    column: number;
    offset: number;
}

/**
 * Enhanced Tokenizer with character-by-character scanning
 */
export class Tokenizer {
    private input: string = '';
    private pos: number = 0;          // Current position in input
    private readPos: number = 0;      // Reading position (after current char)
    private ch: string = '';          // Current character under examination
    private line: number = 1;         // Current line number (1-based)
    private column: number = 1;       // Current column number (1-based)
    private tokens: Token[] = [];

    /**
     * Tokenize input string into tokens
     */
    tokenize(input: string): Token[] {
        this.input = input;
        this.pos = 0;
        this.readPos = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
        this.ch = '';

        // Read first character
        this.readChar();

        while (this.ch !== '') {
            const token = this.nextToken();
            if (token) {
                this.tokens.push(token);
            }
        }

        return this.tokens;
    }

    /**
     * Read the next character and advance position
     */
    private readChar(): void {
        if (this.readPos >= this.input.length) {
            this.ch = '';
        } else {
            this.ch = this.input[this.readPos];
        }
        this.pos = this.readPos;
        this.readPos++;
    }

    /**
     * Peek at the next character without advancing
     */
    private peekChar(): string {
        if (this.readPos >= this.input.length) {
            return '';
        }
        return this.input[this.readPos];
    }

    /**
     * Advance position and update line/column tracking
     */
    private advance(): void {
        if (this.ch === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.readChar();
    }

    /**
     * Get next token from input
     */
    private nextToken(): Token | null {
        // Skip whitespace but preserve newlines for formatting
        if (this.isWhitespace(this.ch) && this.ch !== '\n') {
            this.skipWhitespace();
            // Don't return whitespace tokens, continue to next token
            if (this.ch === '') return null;
        }

        // Capture position AFTER skipping whitespace
        const startLine = this.line;
        const startColumn = this.column;
        const startPos = this.pos;

        // Handle newlines separately
        if (this.ch === '\n') {
            this.advance();
            return this.createToken(TokenType.TOKEN_NEWLINE, '\n', null, startLine, startColumn, startPos, this.pos);
        }

        // Handle single-line comments (-- or //)
        if (this.ch === '-' && this.peekChar() === '-') {
            return this.readComment(startLine, startColumn, startPos);
        }
        if (this.ch === '/' && this.peekChar() === '/') {
            return this.readComment(startLine, startColumn, startPos);
        }

        // Handle multi-line comments (/* */)
        if (this.ch === '/' && this.peekChar() === '*') {
            return this.readMultiLineComment(startLine, startColumn, startPos);
        }

        // Handle string literals
        if (this.ch === '"' || this.ch === "'") {
            return this.readString(startLine, startColumn, startPos);
        }

        // Handle numbers
        if (this.isDigit(this.ch)) {
            return this.readNumber(startLine, startColumn, startPos);
        }

        // Handle identifiers and keywords
        if (this.isLetter(this.ch) || this.ch === '_') {
            return this.readIdentifierOrKeyword(startLine, startColumn, startPos);
        }

        // Handle operators and punctuation
        if (this.isOperatorOrPunctuation(this.ch)) {
            return this.readOperatorOrPunctuation(startLine, startColumn, startPos);
        }

        // Unknown character
        const value = this.ch;
        this.advance();
        return this.createToken(TokenType.TOKEN_ILLEGAL, value, null, startLine, startColumn, startPos, this.pos);
    }

    /**
     * Skip whitespace characters
     */
    private skipWhitespace(): void {
        while (this.ch !== '' && this.isWhitespace(this.ch) && this.ch !== '\n') {
            this.advance();
        }
    }

    /**
     * Read single-line comment
     */
    private readComment(startLine: number, startColumn: number, startPos: number): Token {
        let value = '';
        
        // Skip comment start (-- or //)
        value += this.ch;
        this.advance();
        value += this.ch;
        this.advance();

        // Read until end of line
        while (this.ch !== '' && this.ch !== '\n') {
            value += this.ch;
            this.advance();
        }

        return this.createToken(TokenType.TOKEN_COMMENT, value, null, startLine, startColumn, startPos, this.pos);
    }

    /**
     * Read multi-line comment
     */
    private readMultiLineComment(startLine: number, startColumn: number, startPos: number): Token {
        let value = '';

        // Skip /* 
        value += this.ch;
        this.advance();
        value += this.ch;
        this.advance();

        // Read until */
        while (this.ch !== '') {
            if (this.ch === '*' && this.peekChar() === '/') {
                value += this.ch;
                this.advance();
                value += this.ch;
                this.advance();
                break;
            }
            value += this.ch;
            this.advance();
        }

        return this.createToken(TokenType.TOKEN_COMMENT, value, null, startLine, startColumn, startPos, this.pos);
    }

    /**
     * Read string literal with escape sequence handling
     */
    private readString(startLine: number, startColumn: number, startPos: number): Token {
        const quoteChar = this.ch;
        let value = '';
        let literal = '';

        // Skip opening quote
        value += this.ch;
        this.advance();

        while (this.ch !== '' && this.ch !== quoteChar) {
            // Check for newline (unterminated string)
            if (this.ch === '\n') {
                return this.createToken(TokenType.TOKEN_ILLEGAL, value, null, startLine, startColumn, startPos, this.pos);
            }

            // Handle escape sequences
            if (this.ch === '\\') {
                value += this.ch;
                this.advance();
                
                // Check if we hit EOF after backslash
                // @ts-expect-error - TypeScript doesn't track that advance() mutates this.ch
                if (this.ch === '') {
                    return this.createToken(TokenType.TOKEN_ILLEGAL, value, null, startLine, startColumn, startPos, this.pos);
                }
                
                value += this.ch;
                // Process escape sequence for literal value
                switch (this.ch) {
                    // @ts-expect-error - TypeScript doesn't track that advance() mutates this.ch
                    case 'n': literal += '\n'; break;
                    // @ts-expect-error - TypeScript doesn't track that advance() mutates this.ch
                    case 't': literal += '\t'; break;
                    // @ts-expect-error - TypeScript doesn't track that advance() mutates this.ch
                    case 'r': literal += '\r'; break;
                    case '\\': literal += '\\'; break;
                    // @ts-expect-error - TypeScript doesn't track that advance() mutates this.ch
                    case '"': literal += '"'; break;
                    // @ts-expect-error - TypeScript doesn't track that advance() mutates this.ch
                    case "'": literal += "'"; break;
                    default: literal += this.ch; break;
                }
                this.advance();
            } else {
                value += this.ch;
                literal += this.ch;
                this.advance();
            }
        }

        // Check if we exited due to EOF (unterminated string)
        if (this.ch === '') {
            return this.createToken(TokenType.TOKEN_ILLEGAL, value, null, startLine, startColumn, startPos, this.pos);
        }

        // Skip closing quote
        if (this.ch === quoteChar) {
            value += this.ch;
            this.advance();
        }

        return this.createToken(TokenType.TOKEN_STRING, value, literal, startLine, startColumn, startPos, this.pos);
    }

    /**
     * Read number literal
     */
    private readNumber(startLine: number, startColumn: number, startPos: number): Token {
        let value = '';

        while (this.isDigit(this.ch)) {
            value += this.ch;
            this.advance();
        }

        // Handle decimal numbers
        if (this.ch === '.' && this.isDigit(this.peekChar())) {
            value += this.ch;
            this.advance();

            while (this.isDigit(this.ch)) {
                value += this.ch;
                this.advance();
            }
        }

        const literal = parseFloat(value);
        return this.createToken(TokenType.TOKEN_NUMBER, value, literal, startLine, startColumn, startPos, this.pos);
    }

    /**
     * Read identifier or keyword
     */
    private readIdentifierOrKeyword(startLine: number, startColumn: number, startPos: number): Token {
        let value = '';

        while (this.isLetter(this.ch) || this.isDigit(this.ch) || this.ch === '_') {
            value += this.ch;
            this.advance();
        }

        // Check if it's a keyword
        const tokenType = this.lookupKeyword(value);
        
        return this.createToken(tokenType, value, null, startLine, startColumn, startPos, this.pos);
    }

    /**
     * Read operator or punctuation
     */
    private readOperatorOrPunctuation(startLine: number, startColumn: number, startPos: number): Token {
        const char = this.ch;
        let value = char;
        this.advance();

        // Check for multi-character operators
        if (char === '=' && this.ch === '=') {
            value += this.ch;
            this.advance();
            return this.createToken(TokenType.TOKEN_EQ, value, null, startLine, startColumn, startPos, this.pos);
        }
        if (char === '!' && this.ch === '=') {
            value += this.ch;
            this.advance();
            return this.createToken(TokenType.TOKEN_NOT_EQ, value, null, startLine, startColumn, startPos, this.pos);
        }
        if (char === '<' && this.ch === '=') {
            value += this.ch;
            this.advance();
            return this.createToken(TokenType.TOKEN_LT_EQ, value, null, startLine, startColumn, startPos, this.pos);
        }
        if (char === '>' && this.ch === '=') {
            value += this.ch;
            this.advance();
            return this.createToken(TokenType.TOKEN_GT_EQ, value, null, startLine, startColumn, startPos, this.pos);
        }

        // Single character operators
        const tokenType = this.mapCharToTokenType(char);
        return this.createToken(tokenType, value, null, startLine, startColumn, startPos, this.pos);
    }

    /**
     * Map character to token type
     */
    private mapCharToTokenType(char: string): TokenType {
        switch (char) {
            case '=': return TokenType.TOKEN_ASSIGN;
            case '+': return TokenType.TOKEN_PLUS;
            case '-': return TokenType.TOKEN_MINUS;
            case '*': return TokenType.TOKEN_ASTERISK;
            case '/': return TokenType.TOKEN_SLASH;
            case '<': return TokenType.TOKEN_LT;
            case '>': return TokenType.TOKEN_GT;
            case '(': return TokenType.TOKEN_LPAREN;
            case ')': return TokenType.TOKEN_RPAREN;
            case '{': return TokenType.TOKEN_LBRACE;
            case '}': return TokenType.TOKEN_RBRACE;
            case '[': return TokenType.TOKEN_LBRACKET;
            case ']': return TokenType.TOKEN_RBRACKET;
            case ',': return TokenType.TOKEN_COMMA;
            case ';': return TokenType.TOKEN_SEMICOLON;
            case '.': return TokenType.TOKEN_DOT;
            case ':': return TokenType.TOKEN_COLON;
            default: return TokenType.TOKEN_ILLEGAL;
        }
    }

    /**
     * Lookup keyword or return identifier type
     */
    private lookupKeyword(value: string): TokenType {
        const upper = value.toUpperCase();
        return keywords.get(upper) || TokenType.TOKEN_IDENT;
    }

    /**
     * Create token object
     */
    private createToken(
        type: TokenType,
        value: string,
        literal: any,
        line: number,
        column: number,
        startPos: number,
        endPos: number
    ): Token {
        return {
            Type: type,
            Value: value,
            Literal: literal,
            Line: line,
            Column: column,
            StartPosition: startPos,
            EndPosition: endPos
        };
    }

    /**
     * Character type checks
     */
    private isWhitespace(ch: string): boolean {
        return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
    }

    private isLetter(ch: string): boolean {
        return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
    }

    private isDigit(ch: string): boolean {
        return ch >= '0' && ch <= '9';
    }

    private isOperatorOrPunctuation(ch: string): boolean {
        return '=+-*/()<>{}[],;.:!'.indexOf(ch) !== -1;
    }

    /**
     * Get current position
     */
    getPosition(): TokenPosition {
        return {
            line: this.line,
            column: this.column,
            offset: this.pos
        };
    }
}

/**
 * Keywords map for token type lookup
 */
const keywords = new Map<string, TokenType>([
    // DDL Keywords
    ['CREATE', TokenType.TOKEN_CREATE],
    ['ALTER', TokenType.TOKEN_ALTER],
    ['DROP', TokenType.TOKEN_DROP],
    ['SHOW', TokenType.TOKEN_SHOW],
    ['DATABASE', TokenType.TOKEN_DATABASE],
    ['DATABASES', TokenType.TOKEN_DATABASES],
    ['BUNDLE', TokenType.TOKEN_BUNDLE],
    ['BUNDLES', TokenType.TOKEN_BUNDLES],
    ['FIELD', TokenType.TOKEN_FIELD],
    ['INDEX', TokenType.TOKEN_INDEX],
    
    // DML Keywords
    ['SELECT', TokenType.TOKEN_SELECT],
    ['ADD', TokenType.TOKEN_ADD],
    ['UPDATE', TokenType.TOKEN_UPDATE],
    ['DELETE', TokenType.TOKEN_DELETE],
    ['FROM', TokenType.TOKEN_FROM],
    ['WHERE', TokenType.TOKEN_WHERE],
    ['SET', TokenType.TOKEN_SET],
    ['TO', TokenType.TOKEN_TO],
    ['IN', TokenType.TOKEN_IN],
    ['LIMIT', TokenType.TOKEN_LIMIT],
    
    // DOL Keywords
    ['GRANT', TokenType.TOKEN_GRANT],
    ['REVOKE', TokenType.TOKEN_REVOKE],
    ['ON', TokenType.TOKEN_ON],
    ['FOR', TokenType.TOKEN_FOR],
    
    // Migration Keywords
    ['MIGRATION', TokenType.TOKEN_MIGRATION],
    ['APPLY', TokenType.TOKEN_APPLY],
    ['VALIDATE', TokenType.TOKEN_VALIDATE],
    ['ROLLBACK', TokenType.TOKEN_ROLLBACK],
    
    // Other Keywords
    ['USE', TokenType.TOKEN_USE],
    ['AS', TokenType.TOKEN_AS],
    ['AND', TokenType.TOKEN_AND],
    ['OR', TokenType.TOKEN_OR],
    ['NOT', TokenType.TOKEN_NOT],
    ['NULL', TokenType.TOKEN_NULL],
    ['TRUE', TokenType.TOKEN_TRUE],
    ['FALSE', TokenType.TOKEN_FALSE],
    ['UNIQUE', TokenType.TOKEN_UNIQUE],
    ['NULLABLE', TokenType.TOKEN_NULLABLE],
    ['DEFAULT', TokenType.TOKEN_DEFAULT],
    ['REFERENCES', TokenType.TOKEN_REFERENCES]
]);