
export function logincheck(req, res, next) {
    if (req.user) {
        next()
        return true
    } else {
        res.redirect('/auth/login')
        return false;
    }
}



