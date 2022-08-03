# whiteborb

A free, collaborative, open source whiteboard.

*Update 2022-08-03: Library is deprecated and demo is no longer maintained. Include the name of the drawing in an email to whb0010@protonmail.com if you want the Fabric.js board data. Heroku has had some [security issues](https://www.protocol.com/bulletins/heroku-github-cyberattack-passwords-stolen) recently; I don't have time to move it to a new host at the moment. The code will remain public.*

To run:
- Add your local postgres database credentials to server.js
- Run `node server.js`
- Run `npm run serve`

Backend:
- Node
- Express
- Postgresql

Frontend:
- Vue.js + vue-cli
- Fabric.js
- Socket.io
- MathLive
- vue-color
