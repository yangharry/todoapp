import express from 'express'
import {logincheck} from '../lib/auth.js'
const shopRouter = express.Router()

shopRouter.use('/shirts', logincheck)


shopRouter.get('/shirts',function(req,res){
    res.render('shirts.ejs')
})

shopRouter.get('/pants',function(req,res){
    res.render('pants.ejs')
})

export default shopRouter;