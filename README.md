Compiled with problems:
×
ERROR in ./src/pages/HistoricalData.tsx
Module build failed (from ./node_modules/babel-loader/lib/index.js):
SyntaxError: C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\src\pages\HistoricalData.tsx: Unexpected token (199:189)

  197 |         <Box sx={{ mb: 1.5 }}>
  198 |           <Typography
> 199 |             variant="subtitle The user provided code with errors. There are ESLint errors about React Hooks being called inside callbacks, and runtime errors saying "muiTheme is not defined".
      |                                                                                                                                                                                              ^
  200 |
  201 | First, the ESLint errors: React Hooks like useState can't be called inside callbacks; they must be at the top level of the component or in custom hooks.
  202 |
    at constructor (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:360:19)
    at TypeScriptParserMixin.raise (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:3338:19)
    at TypeScriptParserMixin.unexpected (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:3358:16)
    at TypeScriptParserMixin.jsxParseIdentifier (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6755:12)
    at TypeScriptParserMixin.jsxParseNamespacedName (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6762:23)
    at TypeScriptParserMixin.jsxParseAttribute (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6838:22)
    at TypeScriptParserMixin.jsxParseOpeningElementAfterName (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6853:28)
    at TypeScriptParserMixin.jsxParseOpeningElementAfterName (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:9900:18)
    at TypeScriptParserMixin.jsxParseOpeningElementAt (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6848:17)
    at TypeScriptParserMixin.jsxParseElementAt (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6872:33)
    at TypeScriptParserMixin.jsxParseElementAt (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6884:32)
    at TypeScriptParserMixin.jsxParseElementAt (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6884:32)
    at TypeScriptParserMixin.jsxParseElementAt (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6884:32)
    at TypeScriptParserMixin.jsxParseElement (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6935:17)
    at TypeScriptParserMixin.parseExprAtom (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6945:19)
    at TypeScriptParserMixin.parseExprSubscripts (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10785:23)
    at TypeScriptParserMixin.parseUpdate (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10770:21)
    at TypeScriptParserMixin.parseMaybeUnary (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10750:23)
    at TypeScriptParserMixin.parseMaybeUnary (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:9690:18)
    at TypeScriptParserMixin.parseMaybeUnaryOrPrivate (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10603:61)
    at TypeScriptParserMixin.parseExprOps (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10608:23)
    at TypeScriptParserMixin.parseMaybeConditional (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10585:23)
    at TypeScriptParserMixin.parseMaybeAssign (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10538:21)
    at C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:9628:39
    at TypeScriptParserMixin.tryParse (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:3676:20)
    at TypeScriptParserMixin.parseMaybeAssign (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:9628:18)
    at C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10507:39
    at TypeScriptParserMixin.allowInAnd (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:12126:12)
    at TypeScriptParserMixin.parseMaybeAssignAllowIn (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10507:17)
    at TypeScriptParserMixin.parseParenAndDistinguishExpression (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:11386:28)
    at TypeScriptParserMixin.parseExprAtom (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:11033:23)
    at TypeScriptParserMixin.parseExprAtom (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:6950:20)
    at TypeScriptParserMixin.parseExprSubscripts (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10785:23)
    at TypeScriptParserMixin.parseUpdate (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10770:21)
    at TypeScriptParserMixin.parseMaybeUnary (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10750:23)
    at TypeScriptParserMixin.parseMaybeUnary (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:9690:18)
    at TypeScriptParserMixin.parseMaybeUnaryOrPrivate (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10603:61)
    at TypeScriptParserMixin.parseExprOps (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10608:23)
    at TypeScriptParserMixin.parseMaybeConditional (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10585:23)
    at TypeScriptParserMixin.parseMaybeAssign (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10538:21)
    at TypeScriptParserMixin.parseMaybeAssign (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:9639:20)
    at TypeScriptParserMixin.parseExpressionBase (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10491:23)
    at C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10487:39
    at TypeScriptParserMixin.allowInAnd (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:12121:16)
    at TypeScriptParserMixin.parseExpression (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:10487:17)
    at TypeScriptParserMixin.parseReturnStatement (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:12806:28)
    at TypeScriptParserMixin.parseStatementContent (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:12463:21)
    at TypeScriptParserMixin.parseStatementContent (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:9365:18)
    at TypeScriptParserMixin.parseStatementLike (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:12432:17)
    at TypeScriptParserMixin.parseStatementListItem (C:\Users\yb791f\Downloads\asit-frontend\ASIT_WEB_UI\node_modules\@babel\parser\lib\index.js:12412:17)
ERROR
[eslint] 
src\pages\HistoricalData.tsx
  Line 199:191:  Parsing error: Unterminated string literal
