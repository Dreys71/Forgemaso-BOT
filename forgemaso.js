exports.calc = function (win) {
    let a = Math.random()
    console.log(win, a * win)
    if(a * win < 1){
        return true;
    }
    else {
        return false;
    }
};

