function openNav(x) {
    document.getElementById("side-navbar").style.width = "200px";
    document.getElementById("main-container").style.marginLeft = "300px";
    x.classList.toggle("bar-animation");
}

function closeNav(x) {
    document.getElementById("side-navbar").style.width = "25px";
    document.getElementById("main-container").style.marginLeft = "10%";
    x.classList.toggle("bar-animation");
}

function toggleNav() {
    var x = document.getElementById("side-navbar");
    if (x.style.width = "200px") {
        document.getElementById("side-navbar").style.width = "25px";
        document.getElementById("main-container").style.marginLeft = "10%";
        x.classList.toggle("bar-animation");
        console.log(document.getElementById("side-navbar").style.width);
        
    }

    else {
        document.getElementById("side-navbar").style.width = "200px";
        document.getElementById("main-container").style.marginLeft = "300px";
        x.classList.toggle("bar-animation");
        console.log(document.getElementById("side-navbar").style.width);
    }
}