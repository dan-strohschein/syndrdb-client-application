

// Token represents a lexical token in SyndrQL
type Token = {
	Type :   TokenType
	Value :  string
	Literal: any // Parsed value for literals (int, float, bool, string)
	Line  :  number         // Line number for error reporting
	Column : number         // Column number for error reporting
    StartPosition: number  // Start position in the original input string
    EndPosition  : number  // End position in the original input string
}

// TokenType represents the type of token
type TokenType = string


	// Special tokens
const 	TOKEN_ILLEGAL: TokenType = ToString("")
const 	TOKEN_EOF: string = ToString("EOF")
const	TOKEN_WHITESPACE: string = ToString("WHITESPACE")// Only used internally, filtered out

	// Identifiers and literals
const	TOKEN_IDENT  : string = ToString("IDENT") // bundle_name, field_name, variable
const	TOKEN_STRING : string = ToString("STRING")// "quoted string"
const	TOKEN_NUMBER : string = ToString("NUMBER")// 123, 45.67
const	TOKEN_TRUE   : string = ToString("TRUE")// true
const	TOKEN_FALSE  : string = ToString("FALSE")// false
const	TOKEN_NULL   : string = ToString("NULL")// NULL

const TOKEN_SLASH_COMMENT : string = ToString("//") // -- single line comment or /* multi-line comment */
const TOKEN_OPEN_BLOCK_COMMENT : string = ToString("/*") // /* multi-line comment */
const TOKEN_CLOSE_BLOCK_COMMENT : string = ToString("*/") // */ end of multi-line comment
const TOKEN_DASH_COMMENT : string = ToString("--") // -- single line comment

	// Operators - Arithmetic
	const	TOKEN_PLUS : string  = ToString("+")
	const	TOKEN_MINUS : string = ToString("-")
	const	TOKEN_MULTIPLY : string = ToString("*")
	const	TOKEN_DIVIDE : string = ToString("/")
	const	TOKEN_MODULO : string = ToString("%")
	// Operators - Assignment
	const	TOKEN_ASSIGN : string = ToString("=") // = (single equals for assignment)

	// Operators - Comparison
	const	TOKEN_EQ          : string = ToString("==")
	const	TOKEN_NEQ : string = ToString("!=")
	const	TOKEN_LT  : string = ToString("<")
	const	TOKEN_LTE : string = ToString("<=")
	const	TOKEN_GT  : string = ToString(">")
	const	TOKEN_GTE : string = ToString(">=")
	const	TOKEN_LIKE : string  = ToString("LIKE")
	const	TOKEN_IN : string = ToString("IN")
	const	TOKEN_NOTIN : string = ToString("NOT IN")
	const	TOKEN_IS_NULL : string = ToString("IS NULL")
	const	TOKEN_IS_NOT_NULL : string = ToString("IS NOT NULL")
	const	TOKEN_EXISTS : string = ToString("EXISTS")
	const	TOKEN_CONTAINS : string = ToString("CONTAINS")

	// Operators - Logical
	const	TOKEN_AND : string = ToString("AND")
	const	TOKEN_OR  : string = ToString("OR")
	const	TOKEN_NOT : string = ToString("NOT")

	// Delimiters
	const	TOKEN_COMMA : string  = ToString(",")
    const   TOKEN_ASTERISK : string = ToString("*")
	const	TOKEN_SEMICOLON : string = ToString(";")
	const	TOKEN_COLON : string     = ToString(":")
	const	TOKEN_DOT : string       = ToString(".") // . (for qualified field names like Bundle.Field)
	const	TOKEN_LPAREN : string    = ToString("(")
	const	TOKEN_RPAREN : string    = ToString(")")
	const	TOKEN_LBRACE : string    = ToString("{")
	const	TOKEN_RBRACE : string    = ToString("}")
	const	TOKEN_LBRACKET : string  = ToString("[")
	const	TOKEN_RBRACKET : string  = ToString("]")
	// Keywords - DML (Hot Path)
	const	TOKEN_SELECT : string    = ToString("SELECT")
	const	TOKEN_INSERT : string    = ToString("INSERT")
	const	TOKEN_UPDATE : string    = ToString("UPDATE")
	const	TOKEN_DELETE : string    = ToString("DELETE")
	const	TOKEN_FROM : string      = ToString("FROM")
	const	TOKEN_WHERE : string     = ToString("WHERE")
	const	TOKEN_INTO : string      = ToString("INTO")
	const	TOKEN_VALUES : string    = ToString("VALUES")
	const	TOKEN_SET : string       = ToString("SET")
	const	TOKEN_DOCUMENT : string  = ToString("DOCUMENT")
	const	TOKEN_DOCUMENTS : string = ToString("DOCUMENTS")

	// Keywords - DDL (Warm Path)
	const	TOKEN_CREATE : string = ToString("CREATE")
	const	TOKEN_ALTER  : string = ToString("ALTER")
	const	TOKEN_DROP   : string = ToString("DROP")
	const	TOKEN_BUNDLE : string = ToString("BUNDLE")
	const	TOKEN_WITH   : string = ToString("WITH")
	const	TOKEN_FOR    : string = ToString("FOR")
	const	TOKEN_FIELDS : string = ToString("FIELDS")
	const	TOKEN_ADD    : string = ToString("ADD")
	const	TOKEN_TO     : string = ToString("TO")
	const	TOKEN_NAME   : string = ToString("NAME")
	// Keywords - Query Modifiers
	const	TOKEN_ORDER        : string = ToString("ORDER")
	const	TOKEN_BY           : string = ToString("BY")
	const	TOKEN_LIMIT        : string = ToString("LIMIT")
	const	TOKEN_OFFSET       : string = ToString("OFFSET")
	const	TOKEN_GROUP        : string = ToString("GROUP")
	const	TOKEN_HAVING       : string = ToString("HAVING")
	const	TOKEN_JOIN         : string = ToString("JOIN")
	const	TOKEN_ON           : string = ToString("ON")
	const	TOKEN_AS           : string = ToString("AS")
	const	TOKEN_RELATIONSHIP : string = ToString("RELATIONSHIP") // RELATIONSHIP (for WITH RELATIONSHIP clause)
	const	TOKEN_FORCE        : string = ToString("FORCE") // FORCE (for FORCE switch)
	const	TOKEN_CONFIRMED    : string = ToString("CONFIRMED") // CONFIRMED (for bulk operation safety)
	// Keywords - Utility (Cold Path)
	const	TOKEN_SHOW     : string = ToString("SHOW")
	const	TOKEN_DESCRIBE : string = ToString("DESCRIBE")
	const	TOKEN_USE      : string = ToString("USE")
	const	TOKEN_DATABASE : string = ToString("DATABASE")
	const	TOKEN_BUNDLES  : string = ToString("BUNDLES")
	// Keywords - Views
	const	TOKEN_VIEW         : string = ToString("VIEW")
	const	TOKEN_VIEWS        : string = ToString("VIEWS")
	const	TOKEN_MATERIALIZED : string = ToString("MATERIALIZED")
	const	TOKEN_REFRESH      : string = ToString("REFRESH")

	// Keywords - RBAC
	const	TOKEN_USER        : string = ToString("USER")
	const	TOKEN_PASSWORD   : string = ToString("PASSWORD")
	const	TOKEN_GRANT       : string = ToString("GRANT")
	const	TOKEN_REVOKE      : string = ToString("REVOKE")
	const	TOKEN_ROLE        : string = ToString("ROLE")
	const	TOKEN_DESCRIPTION : string = ToString("DESCRIPTION")
	// Keywords - Types
	const	TOKEN_STRING_TYPE   : string = ToString("STRING")
	const	TOKEN_INT_TYPE      : string = ToString("INT")
	const	TOKEN_FLOAT_TYPE    : string = ToString("FLOAT")
	const	TOKEN_BOOL_TYPE     : string = ToString("BOOL")
	const	TOKEN_ARRAY_TYPE    : string = ToString("ARRAY")
	const	TOKEN_DATE_TYPE     : string = ToString("DATE")
	const	TOKEN_DATETIME_TYPE : string = ToString("DATETIME")

	// Keywords - Field Modification Types
	const	TOKEN_REMOVE_FIELD : string = ToString("REMOVE")
	const	TOKEN_MODIFY_FIELD : string = ToString("MODIFY")
	// Keywords - Migration System
	const	TOKEN_MIGRATION  : string = ToString("MIGRATION")
	const	TOKEN_START      : string = ToString("START")
	const	TOKEN_COMMIT     : string = ToString("COMMIT")
	const	TOKEN_VERSION    : string = ToString("VERSION")
	const	TOKEN_APPLY      : string = ToString("APPLY")
	const	TOKEN_VALIDATE   : string = ToString("VALIDATE")
	const	TOKEN_ROLLBACK   : string = ToString("ROLLBACK")
	const	TOKEN_MIGRATIONS : string = ToString("MIGRATIONS") // MIGRATIONS (for SHOW MIGRATIONS)
	// Keywords - Transaction System
	const	TOKEN_BEGIN       : string = ToString("BEGIN")
	const	TOKEN_TRANSACTION : string = ToString("TRANSACTION")
	const	TOKEN_SAVEPOINT   : string = ToString("SAVEPOINT")
	// Keywords - Prepared Statements
	const	TOKEN_PREPARE    : string = ToString("PREPARE")
	const	TOKEN_EXECUTE    : string = ToString("EXECUTE")
	const	TOKEN_DEALLOCATE : string = ToString("DEALLOCATE")
	// Parameterized Queries
	const	TOKEN_PARAMETER : string = ""// $1, $2, $3, ... (for prepared statements and parameter binding)

	// Keywords - DateTime Functions
	// TODO: I will add TOKEN_DATE_DIFF when implementing interval-based date arithmetic extensions
	// TODO: I will add TOKEN_FORMAT when implementing custom DateTime format output (Phase 2)
	const	TOKEN_FUNCTION   : string = ToString("F:") // F: prefix for function calls (case-insensitive)
	const	TOKEN_NOW        : string = ToString("NOW") 
	const	TOKEN_EXTRACT    : string = ToString("EXTRACT")
	const	TOKEN_DATE_TRUNC : string = ToString("DATE_TRUNC")
	const	TOKEN_DATE_ADD   : string = ToString("DATE_ADD")
	const	TOKEN_DATE_SUB   : string = ToString("DATE_SUB")
	const	TOKEN_AGE        : string = ToString("AGE")
	const	TOKEN_INTERVAL   : string = ToString("INTERVAL") // INTERVAL
	const	TOKEN_AT         : string = ToString("AT") // AT (for AT TIME ZONE)
	const	TOKEN_TIME       : string = ToString("TIME") // TIME (for AT TIME ZONE)
	const	TOKEN_ZONE       : string = ToString("ZONE") // ZONE (for AT TIME ZONE)

	// Keywords - DateTime Units (for EXTRACT and DATE_TRUNC)
	// TODO: I will add TOKEN_WEEK, TOKEN_QUARTER when implementing extended date part extraction
	const	TOKEN_YEAR   : string = ToString("YEAR") // YEAR
	const	TOKEN_MONTH  : string = ToString("MONTH") // MONTH
	const	TOKEN_DAY    : string = ToString("DAY") // DAY
	const	TOKEN_HOUR   : string = ToString("HOUR") // HOUR
	const	TOKEN_MINUTE : string = ToString("MINUTE") // MINUTE
	const	TOKEN_SECOND : string = ToString("SECOND") // SECOND

    const TOKEN_NEWLINE : string = ToString("\n") // NEWLINE - only used internally during tokenization

// String returns the string representation of a token type
function ToString(tt: TokenType) : string {
	switch (tt) {
	case TOKEN_ILLEGAL:
		return "ILLEGAL"
    case TOKEN_SLASH_COMMENT:
		return "//"
	case TOKEN_DASH_COMMENT:
		return "--"
	case TOKEN_OPEN_BLOCK_COMMENT:
		return "/*"
	case TOKEN_CLOSE_BLOCK_COMMENT:
		return "*/"
	case TOKEN_EOF:
		return "EOF"
    case TOKEN_NEWLINE:
        return "\n"
	case TOKEN_WHITESPACE:
		return "WHITESPACE"
	case TOKEN_IDENT:
		return "IDENT"
	case TOKEN_STRING:
		return "STRING"
	case TOKEN_NUMBER:
		return "NUMBER"
	case TOKEN_TRUE:
		return "TRUE"
	case TOKEN_FALSE:
		return "FALSE"
	case TOKEN_NULL:
		return "NULL"
    case TOKEN_ASTERISK:
        return "*"
	case TOKEN_PLUS:
		return "+"
	case TOKEN_MINUS:
		return "-"
	case TOKEN_MULTIPLY:
		return "*"
	case TOKEN_DIVIDE:
		return "/"
	case TOKEN_MODULO:
		return "%"
	case TOKEN_ASSIGN:
		return "="
	case TOKEN_EQ:
		return "=="
	case TOKEN_NEQ:
		return "!="
	case TOKEN_LT:
		return "<"
	case TOKEN_LTE:
		return "<="
	case TOKEN_GT:
		return ">"
	case TOKEN_GTE:
		return ">="
	case TOKEN_LIKE:
		return "LIKE"
	case TOKEN_IN:
		return "IN"
	case TOKEN_NOTIN:
		return "NOT IN"
	case TOKEN_IS_NULL:
		return "IS NULL"
	case TOKEN_IS_NOT_NULL:
		return "IS NOT NULL"
	case TOKEN_EXISTS:
		return "EXISTS"
	case TOKEN_CONTAINS:
		return "CONTAINS"
	case TOKEN_AND:
		return "AND"
	case TOKEN_OR:
		return "OR"
	case TOKEN_NOT:
		return "NOT"
	case TOKEN_COMMA:
		return ","
	case TOKEN_SEMICOLON:
		return ";"
	case TOKEN_COLON:
		return ":"
	case TOKEN_DOT:
		return "."
	case TOKEN_LPAREN:
		return "("
	case TOKEN_RPAREN:
		return ")"
	case TOKEN_LBRACE:
		return "{"
	case TOKEN_RBRACE:
		return "}"
	case TOKEN_LBRACKET:
		return "["
	case TOKEN_RBRACKET:
		return "]"
	case TOKEN_SELECT:
		return "SELECT"
	case TOKEN_INSERT:
		return "INSERT"
	case TOKEN_UPDATE:
		return "UPDATE"
	case TOKEN_DELETE:
		return "DELETE"
	case TOKEN_FROM:
		return "FROM"
	case TOKEN_WHERE:
		return "WHERE"
	case TOKEN_INTO:
		return "INTO"
	case TOKEN_VALUES:
		return "VALUES"
	case TOKEN_SET:
		return "SET"
	case TOKEN_DOCUMENT:
		return "DOCUMENT"
	case TOKEN_DOCUMENTS:
		return "DOCUMENTS"
	case TOKEN_CREATE:
		return "CREATE"
	case TOKEN_ALTER:
		return "ALTER"
	case TOKEN_DROP:
		return "DROP"
	case TOKEN_BUNDLE:
		return "BUNDLE"
	case TOKEN_WITH:
		return "WITH"
	case TOKEN_FIELDS:
		return "FIELDS"
	case TOKEN_ADD:
		return "ADD"
	case TOKEN_TO:
		return "TO"
	case TOKEN_ORDER:
		return "ORDER"
	case TOKEN_BY:
		return "BY"
	case TOKEN_LIMIT:
		return "LIMIT"
	case TOKEN_OFFSET:
		return "OFFSET"
	case TOKEN_GROUP:
		return "GROUP"
	case TOKEN_HAVING:
		return "HAVING"
	case TOKEN_JOIN:
		return "JOIN"
	case TOKEN_ON:
		return "ON"
	case TOKEN_AS:
		return "AS"
	case TOKEN_FOR:
		return "FOR"
	case TOKEN_RELATIONSHIP:
		return "RELATIONSHIP"
	case TOKEN_SHOW:
		return "SHOW"
	case TOKEN_DESCRIBE:
		return "DESCRIBE"
	case TOKEN_USE:
		return "USE"
	case TOKEN_DATABASE:
		return "DATABASE"
	case TOKEN_BUNDLES:
		return "BUNDLES"
	case TOKEN_VIEW:
		return "VIEW"
	case TOKEN_VIEWS:
		return "VIEWS"
	case TOKEN_MATERIALIZED:
		return "MATERIALIZED"
	case TOKEN_REFRESH:
		return "REFRESH"
	case TOKEN_USER:
		return "USER"
	case TOKEN_PASSWORD:
		return "PASSWORD"
	case TOKEN_GRANT:
		return "GRANT"
	case TOKEN_REVOKE:
		return "REVOKE"
	case TOKEN_ROLE:
		return "ROLE"
	case TOKEN_DESCRIPTION:
		return "DESCRIPTION"
	case TOKEN_STRING_TYPE:
		return "STRING_TYPE"
	case TOKEN_INT_TYPE:
		return "INT_TYPE"
	case TOKEN_FLOAT_TYPE:
		return "FLOAT_TYPE"
	case TOKEN_BOOL_TYPE:
		return "BOOL_TYPE"
	case TOKEN_ARRAY_TYPE:
		return "ARRAY_TYPE"
	case TOKEN_DATE_TYPE:
		return "DATE_TYPE"
	case TOKEN_DATETIME_TYPE:
		return "DATETIME_TYPE"
	case TOKEN_FORCE:
		return "FORCE"
	case TOKEN_CONFIRMED:
		return "CONFIRMED"
	case TOKEN_REMOVE_FIELD:
		return "REMOVE_FIELD"
	case TOKEN_MODIFY_FIELD:
		return "MODIFY_FIELD"
	case TOKEN_NAME:
		return "NAME"
	case TOKEN_MIGRATION:
		return "MIGRATION"
	case TOKEN_START:
		return "START"
	case TOKEN_COMMIT:
		return "COMMIT"
	case TOKEN_VERSION:
		return "VERSION"
	case TOKEN_APPLY:
		return "APPLY"
	case TOKEN_VALIDATE:
		return "VALIDATE"
	case TOKEN_ROLLBACK:
		return "ROLLBACK"
	case TOKEN_MIGRATIONS:
		return "MIGRATIONS"
	case TOKEN_BEGIN:
		return "BEGIN"
	case TOKEN_TRANSACTION:
		return "TRANSACTION"
	case TOKEN_SAVEPOINT:
		return "SAVEPOINT"
	case TOKEN_PREPARE:
		return "PREPARE"
	case TOKEN_EXECUTE:
		return "EXECUTE"
	case TOKEN_DEALLOCATE:
		return "DEALLOCATE"
	case TOKEN_PARAMETER:
		return "PARAMETER"
	case TOKEN_FUNCTION:
		return "F:"
	case TOKEN_NOW:
		return "NOW"
	case TOKEN_EXTRACT:
		return "EXTRACT"
	case TOKEN_DATE_TRUNC:
		return "DATE_TRUNC"
	case TOKEN_DATE_ADD:
		return "DATE_ADD"
	case TOKEN_DATE_SUB:
		return "DATE_SUB"
	case TOKEN_AGE:
		return "AGE"
	case TOKEN_INTERVAL:
		return "INTERVAL"
	case TOKEN_AT:
		return "AT"
	case TOKEN_TIME:
		return "TIME"
	case TOKEN_ZONE:
		return "ZONE"
	case TOKEN_YEAR:
		return "YEAR"
	case TOKEN_MONTH:
		return "MONTH"
	case TOKEN_DAY:
		return "DAY"
	case TOKEN_HOUR:
		return "HOUR"
	case TOKEN_MINUTE:
		return "MINUTE"
	case TOKEN_SECOND:
		return "SECOND"
	default:
		return "UNKNOWN"
	}
}

// IsKeyword returns true if the token type is a keyword
function IsKeyword(tt: TokenType) : boolean {
	return tt >= TOKEN_SELECT && tt <= TOKEN_ARRAY_TYPE
}

// IsOperator returns true if the token type is an operator
function IsOperator(tt: TokenType) : boolean {
	return (tt >= TOKEN_PLUS && tt <= TOKEN_MODULO) ||
		(tt >= TOKEN_EQ && tt <= TOKEN_CONTAINS) ||
		(tt >= TOKEN_AND && tt <= TOKEN_NOT)
}

// IsComparison returns true if the token is a comparison operator
function IsComparison(tt: TokenType) : boolean {
	return tt >= TOKEN_EQ && tt <= TOKEN_CONTAINS
}

// IsLogical returns true if the token is a logical operator
function IsLogical(tt: TokenType) : boolean {
	return tt >= TOKEN_AND && tt <= TOKEN_NOT
}

// keywords maps keyword strings to their token types
// This is used for O(1) keyword lookup during tokenization
var keywords = new Map<string, TokenType>([
	// DML Keywords (Hot Path)
	["SELECT",    TOKEN_SELECT],
	["INSERT",    TOKEN_INSERT],
	["UPDATE",    TOKEN_UPDATE],
	["DELETE",    TOKEN_DELETE],
	["FROM",      TOKEN_FROM],
	["WHERE",     TOKEN_WHERE],
	["INTO",      TOKEN_INTO],
	["VALUES",    TOKEN_VALUES],
	["SET",       TOKEN_SET],
	["DOCUMENT",  TOKEN_DOCUMENT],
	["DOCUMENTS", TOKEN_DOCUMENTS],

    ["*", TOKEN_ASTERISK],
    ["//", TOKEN_SLASH_COMMENT],
    ["--", TOKEN_DASH_COMMENT],
    ["/*", TOKEN_OPEN_BLOCK_COMMENT],
    ["*/", TOKEN_CLOSE_BLOCK_COMMENT],
    
	// DDL Keywords (Warm Path)
	["CREATE", TOKEN_CREATE],
	["ALTER",  TOKEN_ALTER],
	["DROP",   TOKEN_DROP],
	["BUNDLE", TOKEN_BUNDLE],
	["WITH",   TOKEN_WITH],
	["FIELDS", TOKEN_FIELDS],
	["ADD",    TOKEN_ADD],
	["TO",     TOKEN_TO],
	["NAME",   TOKEN_NAME],

	// Query Modifiers
	["ORDER",        TOKEN_ORDER],
	["BY",           TOKEN_BY],
	["LIMIT",        TOKEN_LIMIT],
	["OFFSET",       TOKEN_OFFSET],
	["GROUP",        TOKEN_GROUP],
	["HAVING",       TOKEN_HAVING],
	["JOIN",         TOKEN_JOIN],
	["ON",           TOKEN_ON],
	["AS",           TOKEN_AS],
	["FOR",          TOKEN_FOR],
	["RELATIONSHIP", TOKEN_RELATIONSHIP],
	["DESCRIPTION",  TOKEN_DESCRIPTION],
	["FORCE",        TOKEN_FORCE],
	["CONFIRMED",    TOKEN_CONFIRMED],

	// Utility Keywords (Cold Path)
	["SHOW",     TOKEN_SHOW],
	["DESCRIBE", TOKEN_DESCRIBE],
	["USE",      TOKEN_USE],
	["DATABASE", TOKEN_DATABASE],
	["BUNDLES",  TOKEN_BUNDLES],

	// View Keywords
	["VIEW",         TOKEN_VIEW],
	["VIEWS",        TOKEN_VIEWS],
	["MATERIALIZED", TOKEN_MATERIALIZED],
	["REFRESH",      TOKEN_REFRESH],

	// RBAC Keywords
	["USER",     TOKEN_USER],
	["PASSWORD", TOKEN_PASSWORD],
	["GRANT",    TOKEN_GRANT],
	["REVOKE",   TOKEN_REVOKE],
	["ROLE",     TOKEN_ROLE],

	// Operators as keywords
	["AND",      TOKEN_AND],
	["OR",       TOKEN_OR],
	["NOT",      TOKEN_NOT],
	["LIKE",     TOKEN_LIKE],
	["IN",       TOKEN_IN],
	["EXISTS",   TOKEN_EXISTS],
	["CONTAINS", TOKEN_CONTAINS],
	// Literals as keywords
	["TRUE",  TOKEN_TRUE],
	["FALSE", TOKEN_FALSE],
	["NULL",  TOKEN_NULL],
	// Type keywords
	["STRING",   TOKEN_STRING_TYPE],
	["INT",      TOKEN_INT_TYPE],
	["FLOAT",    TOKEN_FLOAT_TYPE],
	["BOOL",     TOKEN_BOOL_TYPE],
	["ARRAY",    TOKEN_ARRAY_TYPE],
	["DATE",     TOKEN_DATE_TYPE],
	["DATETIME", TOKEN_DATETIME_TYPE],

	["REMOVE", TOKEN_REMOVE_FIELD],
	["MODIFY", TOKEN_MODIFY_FIELD],

	// Migration Keywords
	["MIGRATION",  TOKEN_MIGRATION],
	["START",      TOKEN_START],
	["COMMIT",     TOKEN_COMMIT],
	["VERSION",    TOKEN_VERSION],
	["APPLY",      TOKEN_APPLY],
	["VALIDATE",   TOKEN_VALIDATE],
	["ROLLBACK",   TOKEN_ROLLBACK],
	["MIGRATIONS", TOKEN_MIGRATIONS],

	// Transaction Keywords
	["BEGIN",       TOKEN_BEGIN],
	["TRANSACTION", TOKEN_TRANSACTION],
	["SAVEPOINT",   TOKEN_SAVEPOINT],

	// Prepared Statement Keywords
	["PREPARE",    TOKEN_PREPARE],
	["EXECUTE",    TOKEN_EXECUTE],
	["DEALLOCATE", TOKEN_DEALLOCATE],

	// DateTime Function Keywords - REMOVED from keywords map
	// These are ONLY recognized when prefixed with F: (handled by readFunctionToken)
	// "NOW":        TOKEN_NOW,        // Only as F:NOW()
	// "EXTRACT":    TOKEN_EXTRACT,    // Only as F:EXTRACT()
	// "DATE_TRUNC": TOKEN_DATE_TRUNC, // Only as F:DATE_TRUNC()
	// "DATE_ADD":   TOKEN_DATE_ADD,   // Only as F:DATE_ADD()
	// "DATE_SUB":   TOKEN_DATE_SUB,   // Only as F:DATE_SUB()
	// "AGE":        TOKEN_AGE,        // Only as F:AGE()

	// DateTime Operators and Keywords (NOT functions)
	["INTERVAL", TOKEN_INTERVAL],
	["AT",       TOKEN_AT],
	["TIME",     TOKEN_TIME],
	["ZONE",     TOKEN_ZONE],

	// DateTime Unit Keywords (for INTERVAL and EXTRACT)
	["YEAR",   TOKEN_YEAR],
	["MONTH",  TOKEN_MONTH],
	["DAY",    TOKEN_DAY],
	["HOUR",   TOKEN_HOUR],
	["MINUTE", TOKEN_MINUTE],
	["SECOND", TOKEN_SECOND]
]);

// LookupKeyword checks if an identifier is a keyword and returns its token type
// Returns TOKEN_IDENT if not a keyword
function LookupKeyword(ident: string): TokenType {
	if (keywords.has(ident)) {
		return keywords.get(ident) ?? ""
	}
	return TOKEN_IDENT
}
