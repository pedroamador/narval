
'use strict'

const path = require('path')
const fs = require('fs')

const express = require('express')

const data = require('./data')
const memoryData = require('./memoryData')

const books = function (db) {
  const router = express.Router()
  const booksData = db ? new data.Books(db) : new memoryData.Books()

  router.route('/').get((req, res, next) => {
    booksData.get()
      .then((booksList) => {
        console.log('Sending response with books')
        res.status(200)
        res.type('json').send(booksList)
      })
  })

  router.route('/commands').post((req, res, next) => {
    booksData.get()
      .then((booksList) => {
        const destPath = path.resolve(__dirname, '..', '.shared')
        if (req.body.command === 'write-to-shared-folder') {
          console.log('Writing books to shared folder')
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath)
          }
          fs.writeFileSync(path.resolve(destPath, 'books.json'), JSON.stringify(booksList, null, 2), 'utf8')
        }

        res.status(200)
        res.type('json').send(booksList)
      })
  })

  router.route('/').post((req, res, next) => {
    booksData.add(req.body)
      .then((book) => {
        console.log('Sending response with new book')
        res.status(200)
        res.type('json').send(book)
      })
  })

  return router
}

module.exports = {
  books: books
}
