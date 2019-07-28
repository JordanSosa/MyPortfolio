var navIsOpen = false;

function toggleNav() {
    if (navIsOpen == true) {
        document.getElementById("side-navbar").style.width = "25px";
        document.getElementById("main-container").style.marginLeft = "10%";
        document.getElementById("side-navbar").classList.toggle("bar-animation");
        console.log(document.getElementById("side-navbar").style.width);
        navIsOpen = false;
        console.log(navIsOpen);
    }

    else {
        document.getElementById("side-navbar").style.width = "200px";
        document.getElementById("main-container").style.marginLeft = "300px";
        document.getElementById("side-navbar").classList.toggle("bar-animation");
        console.log(document.getElementById("side-navbar").style.width);
        navIsOpen = true;
        console.log(navIsOpen);
    }
}