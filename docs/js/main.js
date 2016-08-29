function main() {
    let button = $("button.nav")
    button.style.color = "rgba(255, 255, 255, 0.5)";
    setTimeout(() => button.style.transition = "color 250ms", 1200);
    button.addEventListener("click", function(e) {
        smoothScroll(innerHeight); // scroll whole page 
    });
}

function smoothScroll(target) {
    const current = window.scrollY;
    let maxScroll = Math.ceil($("html").getBoundingClientRect().height - innerHeight);
    target = Math.min(target, maxScroll);
    const distance = Math.abs(target - current);
    const direction = Math.sign(target - current);
    const time = Math.sqrt(distance) * 5; // in ms

    const factor = time / 2*Math.PI;

    let start;
    let update = function(now) {
        if (!start) start = now;
        let progress = now - start;

        let y = current + direction * distance * (1 - Math.cos(progress / factor))/2;
        if (y - target > -2) return;

        window.scrollTo(0, y|0);

        requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
}

window.$ = s => document.querySelector(s);
document.addEventListener("readystatechange", function(e) {
    if (document.readyState === "complete")
        main();
});
