OpenSeadragon.Viewer.prototype.addButton = function(params={}){
    const prefixUrl=this.prefixUrl;
    let button = new OpenSeadragon.Button({
        tooltip: params.tooltip,
        srcRest: prefixUrl+`button_rest.png`,
        srcGroup: prefixUrl+`button_grouphover.png`,
        srcHover: prefixUrl+`button_hover.png`,
        srcDown: prefixUrl+`button_pressed.png`,
        onClick: params.onClick,
    });
    if(params.faIconClasses){
        let i = document.createElement('i');
        i.classList.add(...params.faIconClasses.split(/\s/), 'button-icon-fa');
        button.element.appendChild(i);
    }
    this.buttonGroup.buttons.push(button);
    this.buttonGroup.element.appendChild(button.element);
    return button;
}

//usage
// viewer.addButton({
//     faIconClasses:'fa-solid fa-rotate', //fontawesome files must be included
//     tooltip:'Rotate image',
//     onClick:()=>{
//         your logic here
//     }
// });