import readline from 'node:readline'

const rln = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
})

const UR = () => Error('unreachable')

class ParseError extends Error {}
class Expectation extends ParseError {
    constructor(expect, got) {
        super(`Expected ${expect}, but got ${got}`)
        this.expect = expect
        this.got = got
    }
}
class CalcError extends Error {}

const expect = (e, t) => {
    throw new Expectation(e, t ? t.join(':') : 'EOI')
}

const D = !! process.env.DEBUG
const debug = (...p) => D && console.debug(...p)

const KW = [ 'def' ]

const funcDefs = {
    '+': {
        params: [ 'a', 'b' ],
        expr: (a, b) => a + b
    },
    '-': {
        params: [ 'a', 'b' ],
        expr: (a, b) => a - b
    }
}

const tokenize = ln => {
    const tokens = []
    if (! ln) return tokens

    let now = null
    const eat = () => {
        if (now) {
            if (now[0] === 'id' && KW.includes(now[1])) {
                now[0] = 'kw'
            }
            tokens.push(now)
            now = null
        }
    }
    for (let i = 0; ln[i]; i ++) {
        if (ln[i].match(/\s/)) {
            eat()
        }
        else if (ln[i] === '-' && ln[i + 1] === '>') {
            eat()
            i ++
            tokens.push([ '->', '->' ])
        }
        else if (ln[i].match(/[a-zA-Z+\-]/)) {
            if (now) {
                if (now[0] !== 'id') throw UR()
                now[1] += ln[i]
            }
            else now = [ 'id', ln[i] ]
        }
        else if ((! now || now[0] === 'num') && ln[i].match(/\d/)) {
            if (now) {
                now[1] += ln[i]
            }
            else now = [ 'num', ln[i] ]
        }
        else {
            eat()
            tokens.push([ ln[i], ln[i] ])
        }
    }
    eat()
    return tokens
}

const getWalker = tokens => {
    let i = 0
    return {
        advance: () => {
            i ++
        },
        now: () => tokens[i]
    }
}

const parse = walker => {
    const parseExpr = (depth, stack) => {
        let token = walker.now()
        if (! token) return null
        if (token[0] === 'num') {
            debug('p Number')
            walker.advance()
            return {
                ty: 'Number',
                val: Number(token[1])
            }
        }
        if (token[0] === 'id') {
            if (stack.includes(token[1])) {
                debug('p Binding')
                walker.advance()
                return {
                    ty: 'Binding',
                    name: token[1]
                }
            }

            debug('p FuncCall')
            debug('s %o', stack)
            const node = {
                ty: 'FuncCall',
                name: token[1],
                args: []
            }
            walker.advance()

            let expr = parseExpr(depth, stack)
            while (expr) {
                node.args.push(expr)
                expr = parseExpr(depth, stack)
            }
            if (! node.args.length) expect('Expr in FuncCall', walker.now())

            return node
        }
        else if (token[0] === ')') {
            if (! depth) throw new ParseError('Unexpected )')
            return null
        }
        else if (token[0] === '(') {
            debug('p (')
            walker.advance()
            return parseExpr(depth + 1, stack)
        }
    }

    for (let token = walker.now(); token; walker.advance(), token = walker.now()) {
        if (token[0] === 'kw' && token[1] === 'def') {
            const node = {
                ty: 'FuncDef',
                params: []
            }
            walker.advance()

            let token = walker.now()
            if (! token || token[0] !== 'id') expect('Func name', token)
            node.name = token[1]

            walker.advance()
            for (let token = walker.now(); token; walker.advance(), token = walker.now()) {
                if (token[0] === '->') {
                    walker.advance()
                    node.expr = parseExpr(0, [ ...node.params ])
                    if (! node.expr) expect('expr', walker.now())
                    return node
                }
                if (token[0] === 'id') {
                    node.params.push(token[1])
                }
                else expect('Func params or ->', token)
            }
        }

        return parseExpr(0, [])
    }
}

const calc = (ast, env) => {
    debug('c node %o', ast)
    debug('c env %o', env)
    switch (ast.ty) {
        case 'Binding':
            return env[ast.name]
        case 'Number':
            return ast.val
        case 'FuncDef':
            funcDefs[ast.name] = ast
            return null
        case 'FuncCall':
            const def = funcDefs[ast.name]
            if (! def) throw new CalcError('Undefined Func ' + ast.name)
            if (ast.args.length !== def.params.length) throw new CalcError('Arg count not matched')

            const argVals = ast.args.map(expr => calc(expr, env))
            debug('c args %o', argVals)
            if (typeof def.expr === 'function') return def.expr(...argVals)

            const argsEnv = Object.fromEntries(def.params.map((name, i) => [ name, argVals[i] ]))
            return calc(def.expr, { ...env, ...argsEnv })
        default:
            throw UR()
    }
}

rln.prompt()

rln.on('line', ln => {
    try {
        debug(ln)
        const tokens = tokenize(ln)
        debug('tokens\n%o', tokens)
        const walker = getWalker(tokens)
        const ast = parse(walker)
        debug('ast\n%o', ast)
        const result = calc(ast, {})
        console.log(result)
    }
    catch (err) {
        console.error('\x1B[31m' + (D ? err : err.message) + '\x1B[0m')
        if (err instanceof CalcError || err instanceof ParseError) ;
        else process.exit(1)
    }
    rln.prompt()
})
