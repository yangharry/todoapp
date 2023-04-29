import express from 'express'
const app = express()
const port = 3000
import path from 'path'
const __dirname = path.resolve();
import bodyParser from 'body-parser'
app.set('view engine', 'ejs')

import dotenv from 'dotenv'
dotenv.config()

import { nGram } from 'n-gram'

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.json())
import methodOverride from 'method-override'
app.use(methodOverride('_method'))




import session from 'express-session'
app.use(session({
    secret: '비밀코드',
    resave: true,
    saveUninitialized: false,
    // cookie: {
    //     maxAge: 60 * 60 * 24 * 14
    // }
}))



import MongoClient from 'mongodb'
const Mongo = MongoClient.MongoClient;
const ObjId = MongoClient.ObjectId;

var db;
Mongo.connect(process.env.DB_URL, function (err, client) {
    if (err) return console.log(err)
    db = client.db(process.env.DB_NAME)
})

import passport from 'passport';
import local from 'passport-local';
import { logincheck } from './lib/auth.js'

const LocalStrategy = local.Strategy

app.use(passport.initialize())
app.use(passport.session())

passport.serializeUser(function (user, done) {
    done(null, user.id)
})

passport.deserializeUser(function (아이디, done) {
    db.collection('login').findOne({ id: 아이디 }, function (err, user) {
        done(null, user)
    })
})

passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,
}, function (입력한아이디, 입력한비번, done) {
    // console.log(입력한아이디, 입력한비번);
    db.collection('login').findOne({ id: 입력한아이디 }, function (err, user) {
        if (err) return done(err)

        if (!user) return done(null, false, { message: '존재하지않는 아이디입니다.' })
        if (입력한비번 == user.pw) {
            return done(null, user)
        } else {
            return done(null, false, { message: '비밀번호가 틀렸습니다.' })
        }
    })
}));

import shopRouter from './routes/shop.js'

app.use('/shop', shopRouter)

// app.put('/message/:id', logincheck, function (req, res) {
//     console.log(req.params, req.query, req.body)
//     db.collection('chatroom' + req.params.id).updateOne({ _id: ObjId(req.body._id) }, { $set: { content: '삭제된 메세지입니다.' } }).then((result) => {
//     })
// })

app.delete('/message/:id', logincheck, function (req, res) {
    console.log(req.params, req.query, req.body)
    db.collection('chatroom' + req.params.id).deleteOne({ _id: ObjId(req.query._id) }).then((result) => {
        res.status(200).send({massage : '삭제완료'})
    })
})



app.post('/message/:id', logincheck, function (req, res) {
    var 저장할거 = {
        writeuser: req.user.id,
        content: req.body.content,
        date: new Date().valueOf()
    }
    db.collection('chatroom' + req.params.id).insertOne(저장할거).then((result) => {
        res.status(200).send({massage : '저장완료'})
    })
})

app.get('/message/:id', logincheck, function (req, res) {

    res.writeHead(200, {
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
    });

    db.collection('chatrooms').findOne({ _id: ObjId(req.params.id) }).then((result) => {
        res.write('event: title\n');
        res.write('data:' + JSON.stringify(result) + '\n\n');
    })

    db.collection('chatroom' + req.params.id).find().toArray().then((result) => {
        res.write('event: test\n');
        res.write('data:' + JSON.stringify({data:result}) + '\n\n');
    })

    // const pipeline = { fullDocument : 'updateLookup' }
    // const pipeline = [{ $match: {} }]


    const collection = db.collection('chatroom' + req.params.id)
    // const changeStream = collection.watch(pipeline)
    const changeStream = collection.watch()
    changeStream.on('change', (result) => {
        // console.log(result)
        if (result.operationType == 'insert') {
            res.write('event: test\n');
            res.write('data:' + JSON.stringify({ data: [result.fullDocument], operationType: result.operationType }) + '\n\n');
        } else if (result.operationType == 'delete') {
            res.write('event: test\n');
            res.write('data:' + JSON.stringify({ data: result.documentKey, operationType: result.operationType }) + '\n\n');
        }

    })

    // changeStream.on('error',(err)=>{
    //     console.log(err)
    // }) 
});


app.get('/chatroom', logincheck, function (req, res) {
    db.collection('chatrooms').find({ $or: [{ host: req.user.id }, { participants: req.user.id }] }).toArray((err, result1) => {
        db.collection('login').find().toArray((err, result2) => {
            // console.log(result)
            let friends = result2.filter((result) => {
                return result._id.toString().indexOf(req.user._id.toString())
            })
            res.render('chatroom.ejs', { friends: friends, chatrooms: result1, me: req.user.id })
        })
    })


})

app.post('/chatroom_add', logincheck, function (req, res) {
    var 저장할거 = {
        host: req.user.id,
        participants: req.body.participants,
        title: req.body.title,
        date: new Date().valueOf()
    }
    db.collection('chatrooms').insertOne(저장할거).then((result) => {
        console.log(result.insertedId)
        res.status(200).send({ message: '저장완료' })
    })
})

import multer from 'multer'
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/image')
    },
    filename: function (req, file, cb) {
        console.log(req.user._id)
        var time = new Date()
        // console.log(time.toLocaleString())
        // console.log(time.valueOf())
        // console.log(new Date(time.valueOf()).toLocaleString())
        var newFileName = req.user._id + time.valueOf() + file.originalname
        cb(null, newFileName)
    },
    filefilter: function (req, file, cb) {

    },
    // limits :
})

var upload = multer({ storage: storage })

app.get('/upload', logincheck, function (req, res) {
    res.render('upload.ejs')
})

app.post('/upload', upload.single('imgfile'), function (req, res) {

    var url = req.protocol + '://' + req.get('host')
    console.log(url)
    console.log(req.file)
    var data = {
        id: req.user._id,
        filename: req.file.filename,
        url: url + '/image/' + req.file.filename,
        path: req.file.path,
    }
    db.collection('image').insertOne(data).then((result) => {
        console.log('완료')
        res.redirect('/upload')
    })
})

app.get('/myimage', logincheck, function (req, res) {
    console.log(req.user._id)
    db.collection('image').find({ id: req.user._id }).toArray((err, result) => {
        res.render('myimage.ejs', { myimage: result, 사용자: req.user.id })
    })
})

app.get('/image/:id', function (req, res) {
    if (req.user) {
        db.collection('image').findOne({ filename: req.params.id }).then((result) => {
            // console.log(req.user._id, result.id)
            if (req.user._id.toString() == result.id.toString()) {
                res.sendFile(__dirname + '/public/image/' + req.params.id)
            } else {
                res.send('비공개 사진입니다.')
            }
        })
    } else {
        res.redirect('/auth/login')
    }
})


app.get('/auth/login', function (req, res) {
    res.render('login.ejs')
})

app.post('/auth/login', passport.authenticate('local', {
    failureRedirect: '/auth/login'
}), function (req, res) {
    res.redirect('/')
})

app.get('/auth/logout', function (req, res) {
    req.logout(function (err) {
        res.redirect('/')
    })
})

app.get('/signup', function (req, res) {
    res.render('signup.ejs')
})

app.post('/signup', function (req, res) {
    var 회원가입정보 = { id: req.body.id, pw: req.body.pw };
    db.collection('login').insertOne(회원가입정보).then((result) => {
        res.redirect('/auth/login')
    })
})



app.get('/mypost', logincheck, function (req, res) {
    var 찾는것 = { writeuser: req.user._id }
    if (!req.query.search) {
        db.collection('post').find(찾는것).toArray(function (err, result) {
            res.render('mypost.ejs', { posts: result, 사용자: req.user.id })
        })
    } else {
        // db.collection('post').find({ title: RegExp(req.query.search) }).toArray((err, result) => {
        //     res.render('list.ejs', { posts: result })
        // })
        db.collection('post').find({ $text: { $search: req.query.search } }).toArray((err, result) => {
            res.render('mypost.ejs', { posts: result, 사용자: req.user.id })
        })
    }
})




app.put('/edit/:id', function (req, res) {

    db.collection('post').updateOne(
        { number: parseInt(req.params.id) }, // 링크로 구별할 경우
        // { number: parseInt(req.body.id) }, input 태그 id로 보낼경우 body
        { $set: { title: req.body.title, date: req.body.date } })
        .then((result) => {
            console.log('수정완료')
            res.redirect('/list')
        }).catch((err) => {
            console.log('수정실패', err)
            res.redirect('/edit/' + req.body.id)
        })
})

app.get('/edit/:id', function (req, res) {
    db.collection('post').findOne({ number: parseInt(req.params.id) }, function (err, result) {
        if (result) {
            res.render('edit.ejs', { post: result })
        } else {
            res.send('없는 페이지입니다.')
        }
    })
})

app.put('/detail_edit/:id', function (req, res) {
    db.collection('comment' + parseInt(req.params.id)).updateOne(
        { _id: ObjId(req.body.id) },
        { $set: { comment: req.body.comment } })
        .then((result) => {
            res.redirect('/detail/' + req.params.id)
        })
})

app.post('/detail/:id', function (req, res) {
    // console.log(req)

    var 저장할거 = { comment: req.body.comment }

    db.collection('comment' + parseInt(req.params.id)).insertOne(저장할거).then((result) => {
        res.redirect('/detail/' + parseInt(req.params.id))
    });
});

app.delete('/detail_delete', function (req, res) {
    console.log(req.query, req.body)
    var 삭제할데이터 = { comment: req.query.comment }
    db.collection('comment' + parseInt(req.query.number)).deleteOne(삭제할데이터).then((result) => {
        // console.log(result)
        res.status(200).send({ message: '삭제완료' })
    }).catch((err) => {
        // console.log(err)
        res.status(400).send({ message: '삭제실패' })
    })
})

app.get('/detail/:id', function (req, res) {
    db.collection('post').findOne({ number: parseInt(req.params.id) }, function (err, result1) {
        if (result1) {
            db.collection('comment' + parseInt(req.params.id)).find().toArray(function (err, result2) {
                // console.log(result1)
                // console.log(err)
                res.render('detail.ejs', { data: result1, comments: result2 })
            })

        } else {
            res.send('없는 페이지입니다.')
        }
    })
})
app.get('/comment/:id', function (req, res) {
    db.collection('post').findOne({ number: parseInt(req.params.id) }, function (err, result1) {
        if (result1) {
            db.collection('comment' + parseInt(req.params.id)).find().toArray(function (err, result2) {
                // console.log(result1)
                // console.log(err)
                res.render('comment.ejs', { data: result1, comments: result2 })
            })

        } else {
            res.send('없는 페이지입니다.')
        }
    })
})



app.delete('/delete', function (req, res) {
    console.log(req.query.number)
    var 삭제할데이터 = { number: parseInt(req.query.number), writeuser: req.user._id }
    db.collection('post').deleteOne(삭제할데이터).then((result) => {
        if (result.deletedCount) {
            db.collection('comment' + parseInt(req.query.number)).findOne().then((result) => {
                // console.log(result)
                if (result) {
                    db.collection('comment' + parseInt(req.query.number)).drop()
                    res.status(200).send({ message: '삭제완료' })
                } else {
                    res.status(200).send({ message: '삭제완료' })
                }
            })
        } else {
            res.status(400).send({ message: '삭제실패' })
        }
    }).catch((err) => {
        res.status(400).send({ message: '삭제실패' })
    })
})

app.get('/list', function (req, res) {
    if (!req.query.search) {
        db.collection('post').find().toArray(function (err, result) {
            res.render('list.ejs', { posts: result })
        })
    } else {
        // db.collection('post').find({ title: RegExp(req.query.search) }).toArray((err, result) => {
        //     res.render('list.ejs', { posts: result })
        // })
        db.collection('post').find({ $text: { $search: req.query.search } }).toArray((err, result) => {
            res.render('list.ejs', { posts: result })
        })
    }
})

app.post('/add', logincheck, function (req, res) {
    console.log(req.user._id)
    db.collection('counter').findOne({ name: 'totalpost' }, function (err, result) {
        const 초성 = [
            'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ',
            'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ',
            'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
        ];
        var data = req.body.title.replace(/ /gi, "");
        var data2 = [];
        for (var i = 0; i < data.length; i++) {
            data2.push(...초성[parseInt(((data.charCodeAt(i)) - 44032) / 588)])
        }
        var data3 = [];
        data3.push(data, data2.join(""))
        var data4 = data3.join("")
        var 키워드 = [];
        for (var i = 1; i <= data.length; i++) {
            키워드.push(...nGram(i)(data4))
        }

        var totalposts = result.num;

        var 저장할거 = {
            number: totalposts,
            title: req.body.title,
            date: req.body.date,
            keyword: 키워드,
            writeuser: req.user._id
        }

        db.collection('post').insertOne(저장할거);
        db.collection('counter').updateOne({ name: 'totalpost' }, { $inc: { num: 1 } })
        res.redirect('/write')
    })

})


app.get('/', function (req, res) {
    res.render('index.ejs', { logined: req.user })
})

app.get('/write', function (req, res) {
    res.render('write.ejs')
})

app.listen(port, function () {
    console.log('listening on 3000')
})






