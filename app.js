const express = require('express');
const app = express();
const port = 8081;

app.use(express.static('.', { extensions: ['js'] }));
app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
