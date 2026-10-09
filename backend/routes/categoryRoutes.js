const router = require('express').Router();
const c = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const v = require('../middleware/validators');

router.get('/', c.listCategories);
router.post('/', protect, v.category, c.createCategory);
router.put('/:id', protect, v.mongoId, v.category, c.updateCategory);
router.delete('/:id', protect, v.mongoId, c.deleteCategory);

module.exports = router;
