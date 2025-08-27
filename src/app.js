const path = require('path');
const express = require('express');
const norgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const pagesRoutes = require('./routes/pages');
const favoritesRoutes = require('./routes/favorites');
const attachUser = require('./middleware/attachUser');
const methodOverride = require('method-override');
const chatsRoutes = require('./routes/chats');

const app = express();

const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'public/uploads');

//base middleware
app.use(helmet());
app.use(cors({origin:true, credentials:true}));
app.use(norgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public')));
app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));

app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');

app.use(methodOverride('_method'));
app.use(attachUser);  
app.use('/api/chats', chatsRoutes);

app.use('/uploads', express.static(uploadsDir));



app.use('/', pagesRoutes);
//router
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/favorites', favoritesRoutes);

//health check
app.get('/health', (req, res) => res.json({ok:true}));

//error handling
app.use((err, req, res, next) => {
  console.error('ERROR:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Error' });
});

module.exports = app;