const argv = require('minimist')(process.argv.slice(2), {
  string: ['number', 'string']
})

console.log(argv)

const number = argv.number
const string = argv.string

console.log(number, string)
