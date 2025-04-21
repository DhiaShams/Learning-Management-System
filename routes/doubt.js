const express = require('express');
const router = express.Router();
const doubtController = require('../controllers/doubtController');

router.post('/ask', doubtController.postDoubt);
router.get('/course/:courseId', doubtController.getDoubts);
router.put('/answer/:doubtId', doubtController.answerDoubt);

module.exports = router;
