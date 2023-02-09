// import {AnnotationToolkit} from '/node_modules/osd-paperjs-annotation/js/annotationtoolkit.mjs';
import {RotationControlOverlay} from '/node_modules/osd-paperjs-annotation/js/rotationcontrol.mjs';
// let DSA = window.DSA;

// constants
const transparentGlassRGBThreshold = 10;

// let dsaItems = window.App.dsaItems;
// let demoImages = window.App.demoImages;
let cases = App.demoImages.reduce((acc,item)=>{
    if(!acc[item.meta.accession]){
        acc[item.meta.accession] = {items: []};
    }
    acc[item.meta.accession].items.push(item); 
    return acc; 
}, {});
Object.values(cases).forEach( c => {
    c.blocks = c.items.reduce((acc,item)=>{
        let block = item.meta.block.replace(':00 AM', ' A').replace(':00 PM', ' P');
        if(!acc[block]){
            acc[block] = [];
        }
        acc[block].push(item); 
        return acc; 
    }, {});
});

// let tilesource1 = demoImages[3].tileSource;
// let tilesource2 = demoImages[4].tileSource;

let drawingCanvas = document.createElement('canvas');


// let staticViewer = window.viewer1 = makeViewer('viewer-static', tilesource1);
// let movingViewer = window.viewer2 = makeViewer('viewer-moving', tilesource2);
let staticViewer = window.viewer1 = makeViewer('viewer-static');
let movingViewer = window.viewer2 = makeViewer('viewer-moving');
staticViewer.synchronizedViewers = [{viewer:movingViewer}];
movingViewer.synchronizedViewers = [{viewer:staticViewer}];
staticViewer.addHandler('open',onImageOpen);
movingViewer.addHandler('open',onImageOpen);
staticViewer.rotationControl = new RotationControlOverlay(staticViewer);
movingViewer.rotationControl = new RotationControlOverlay(movingViewer);

setupImagePicker(cases);

function onImageOpen(event){
    let viewer = event.eventSource;
    
    let tileSource = viewer.world.getItemAt(0).source;
    if(tileSource.backgroundColor){
        $(viewer.element).css('--background-color',`rgb(${color.red}, ${color.green}, ${color.blue})`);
    } else {
         getGlassColor(tileSource).then(color=>{
            tileSource.backgroundColor = color;
            //make sure we're still viewing this tile source before updating the viewer background color
            if(viewer.world.getItemAt(0).source == tileSource){
                $(viewer.element).css('--background-color',`rgb(${color.red}, ${color.green}, ${color.blue})`);
            }  
        });
    }

    initializeSynchronizeBehavior();
   
}


$('input.opacity-slider').on('input',function(){
    $('.openseadragon-canvas').css('--stacked-opacity',this.value/100);
}).trigger('input');

$('input.glass-checkbox').on('change',function(){
    if(this.checked){
        enableTransparentBackground(staticViewer, transparentGlassRGBThreshold, 0);
        enableTransparentBackground(movingViewer, transparentGlassRGBThreshold, 0);
    } else {
        disableTransparentBackground(staticViewer);
        disableTransparentBackground(movingViewer);
    }
}).attr('checked',false);

$('input.combine-checkbox').on('change',function(){
    if(this.checked){
        $('.viewer-container').addClass('stacked').removeClass('side-by-side');
        staticViewer.rotationControl.deactivate();
    } else {
        $('.viewer-container').addClass('side-by-side').removeClass('stacked');
    }
}).attr('checked',false);

$('input.sync-checkbox').on('change',function(){
    if(this.checked){
        setSynchronizingMatrices();

        staticViewer.addHandler('pan',synchronizingPanHandler);
        movingViewer.addHandler('pan',synchronizingPanHandler);

        staticViewer.addHandler('rotate',synchronizingRotateHandler);
        movingViewer.addHandler('rotate',synchronizingRotateHandler);

        staticViewer.removeHandler('pan', setSynchronizingMatrices);
        movingViewer.removeHandler('pan', setSynchronizingMatrices);
        
        staticViewer.removeHandler('rotate', setSynchronizingMatrices);
        movingViewer.removeHandler('rotate', setSynchronizingMatrices);
    } else {
        staticViewer.removeHandler('pan',synchronizingPanHandler);
        movingViewer.removeHandler('pan',synchronizingPanHandler);

        staticViewer.removeHandler('rotate',synchronizingRotateHandler);
        movingViewer.removeHandler('rotate',synchronizingRotateHandler);

        staticViewer.addHandler('pan', setSynchronizingMatrices);
        movingViewer.addHandler('pan', setSynchronizingMatrices);
        
        staticViewer.addHandler('rotate', setSynchronizingMatrices);
        movingViewer.addHandler('rotate', setSynchronizingMatrices);
    }
}).attr('checked',false);

$('.viewport-images .toggle').on('click',function(){
    $('.img-rect').toggle();
});
$('.viewport-images input[type=number]').on('input',function(){
    let dims = $('.viewport-images input[type=number]').toArray().map(i=>i.value);
    let px = dims.map(d=>d+'px');
    $('.img-rect').css({width: px[0], height: px[1]});
    $('.viewport-images').css({'--img-aspect-ratio': `${dims[0]} / ${dims[1]}`});
    drawingCanvas.width = dims[0];
    drawingCanvas.height = dims[1];
}).trigger('input');

$('.create-background-images').on('click',()=>{
    let targetContainer = $('.image-info .background-images .viewport-image-container');
    targetContainer.empty();
    createImages(targetContainer, 0);
    $('.image-sets.disabled').removeClass('disabled');
});
$('.create-viewport-images').on('click',()=>{
    let targetContainer = $('.image-info .image-sets .viewport-image-container');
    targetContainer.empty();
    let bgImgs = $('.background-images img').toArray();
    createTransformedImages(targetContainer, $('.image-sets .num-sets').val(), bgImgs).then(()=>{
        console.log('All created!');
    });
});
function createImages(targetContainer, remainingIterations, bgImgs=[]){
    let staticImage = getImageRect(staticViewer, bgImgs[0], 'image/png');
    targetContainer.append($('<img>',{src:staticImage, class:'static-image'}));

    let movingImage = getImageRect(movingViewer, bgImgs[1], 'image/png');
    targetContainer.append($('<img>',{src:movingImage, class:'moving-image'}));
}
function createTransformedImages(targetContainer, remainingIterations, bgImgs=[]){
    let rotation1 = Math.random()*360;
    let rotation2 = Math.random()*360;

    let tx1 = Math.random()*0.2;
    let ty1 = Math.random()*0.2;

    let tx2 = Math.random()*0.2;
    let ty2 = Math.random()*0.2;

    let transform = {
        dTheta: rotation2-rotation1,
        dX: tx2-tx1,
        dY: ty2-ty1,
    };
    console.log(transform);
    //rotate and translate operation 1 - before getting static image
    staticViewer.viewport.rotateBy(rotation1, null, true);
    staticViewer.viewport.panBy(new OpenSeadragon.Point(tx1, ty1), true);
    //wait for the viewers to update
    return Promise.all([
        new Promise(resolve=>staticViewer.addOnceHandler('update-viewport',()=>resolve())),
        new Promise(resolve=>movingViewer.addOnceHandler('update-viewport',()=>resolve())),
    ]).then( ()=>{
        //get staticImage data in transformed state
        let staticImage = getImageRect(staticViewer, bgImgs[0], 'image/png');
        targetContainer.append($('<img>',{src:staticImage, class:'static-image'}));

        //undo operation 1
        staticViewer.viewport.rotateBy(-rotation1, null, true);
        staticViewer.viewport.panBy(new OpenSeadragon.Point(-tx1, -ty1), true);

        //rotate and translate operation 2 - before getting moving image
        staticViewer.viewport.rotateBy(rotation2, null, true);
        staticViewer.viewport.panBy(new OpenSeadragon.Point(tx2, ty2), true);

        //wait for viewers to update
        return Promise.all([
            new Promise(resolve=>staticViewer.addOnceHandler('update-viewport',()=>resolve())),
            new Promise(resolve=>movingViewer.addOnceHandler('update-viewport',()=>resolve())),
        ])
    }).then( ()=>{
        let movingImage = getImageRect(movingViewer, bgImgs[1], 'image/png');
        targetContainer.append($('<img>',{src:movingImage, class:'moving-image', 'data-transform':JSON.stringify(transform)}));

        //undo operation 2
        staticViewer.viewport.rotateBy(-rotation2, null, true);
        staticViewer.viewport.panBy(new OpenSeadragon.Point(-tx2, -ty2), true);

        //wait for viewers to update
        return Promise.all([
            new Promise(resolve=>staticViewer.addOnceHandler('update-viewport',()=>resolve())),
            new Promise(resolve=>movingViewer.addOnceHandler('update-viewport',()=>resolve())),
        ])
        
    }).then( ()=>{
        if(remainingIterations > 1){
            return createTransformedImages(targetContainer, remainingIterations-1, bgImgs);
        } else {
            return;
        }
    });

}

function getImageRect(viewer, backgroundImg, type='image/jpg'){
    let pixelRatio = OpenSeadragon.pixelDensityRatio;
    let center_x = viewer.drawer.canvas.width/2;
    let center_y = viewer.drawer.canvas.height/2;
    let w = drawingCanvas.width;
    let h = drawingCanvas.height;
    let left = Math.round(center_x - w*pixelRatio/2);
    let top = Math.round(center_y - h*pixelRatio/2);
    
    let ctx = drawingCanvas.getContext("2d",{willReadFrequently: true});
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'darken';
    ctx.clearRect(0, 0, w, h);
    if(backgroundImg){
        ctx.drawImage(backgroundImg, 0, 0);
    }
    ctx.drawImage(viewer.drawer.canvas, left, top, w*pixelRatio, h*pixelRatio, 0, 0, w, h);

    return drawingCanvas.toDataURL(type);
}

function setSynchronizingMatrices(){
    //create affine matrices
    //depends on paper.js
    //TO DO: paper.js probably isn't necessary... could likely be implemented with just OpenSeadragon

    let m1 = new paper.Matrix();
    m1.translate(staticViewer.viewport.getCenter(false));
    m1.rotate(-staticViewer.viewport.getRotation(false));
    m1.scale(1/staticViewer.viewport.getZoom(false));
    let m2 = new paper.Matrix();
    m2.translate(movingViewer.viewport.getCenter(false));
    m2.rotate(-movingViewer.viewport.getRotation(false));
    m2.scale(1/movingViewer.viewport.getZoom(false));
    
    let transform1to2 = m2.appended(m1.inverted());
    staticViewer.synchronizedViewers[0].transformMatrix = transform1to2;
    movingViewer.synchronizedViewers[0].transformMatrix = transform1to2.inverted();
}

function initializeSynchronizeBehavior(){
    //perform initial zoom to same real-world coordinates (given by mm_x and width values);
    let item1 = staticViewer.world.getItemAt(0);
    let item2 = movingViewer.world.getItemAt(0);
    if(!item1 || !item2){
        return;
    }
    let ts1 = item1.source;
    let ts2 = item2.source;
    movingViewer.viewport.zoomTo(staticViewer.viewport.getZoom() * (ts2.mm_x * ts2.width) / (ts1.mm_x * ts1.width) );

    setSynchronizingMatrices();

    staticViewer.addHandler('zoom',synchronizingZoomHandler);
    movingViewer.addHandler('zoom',synchronizingZoomHandler);
    staticViewer.addHandler('pan', setSynchronizingMatrices);
    movingViewer.addHandler('pan', setSynchronizingMatrices);
    
    staticViewer.addHandler('rotate', setSynchronizingMatrices);
    movingViewer.addHandler('rotate', setSynchronizingMatrices);

}

function synchronizingPanHandler(event){
    //self is the viewer initiating the viewport-change event
    let self = event.eventSource;
    //set flag so other viewer won't send return signal
    self.synchronizing = true;
    //arr is the list of viewers to synchronize with
    let arr = self.synchronizedViewers || [];
    arr.forEach(d=>{
        //(potential) target viewer
        let target = d.viewer;
        let transformMatrix = d.transformMatrix;
        
        if(target.synchronizing) return;
        
        if(!target || !transformMatrix){
            console.error('synchronizingViewer data not properly formed');
            return;
        }
        let center = self.viewport.getCenter();
        let newCenter = transformMatrix.transform(new paper.Point(center.x, center.y));
        target.viewport.panTo(newCenter, event.immediately);

    });
    //unset flag
    self.synchronizing=false;
}
function synchronizingZoomHandler(event){
    //self is the viewer initiating the viewport-change event
    let self = event.eventSource;
    //set flag so other viewer won't send return signal
    self.synchronizing = true;
    //arr is the list of viewers to synchronize with
    let arr = self.synchronizedViewers || [];
    arr.forEach(d=>{
        //(potential) target viewer
        let target = d.viewer;
        let transformMatrix = d.transformMatrix;
        
        if(target.synchronizing) return;
        
        if(!target || !transformMatrix){
            console.error('synchronizingViewer data not properly formed');
            return;
        }
        let zoom = self.viewport.getZoom();
        let newZoom = zoom * 1/transformMatrix.scaling.x;
        let refPoint = event.refPoint || self.viewport.getCenter();
        let transformed = transformMatrix.transform(new paper.Point(refPoint.x, refPoint.y));
        let newRefPoint = new OpenSeadragon.Point(transformed.x, transformed.y);
       
        target.viewport.zoomTo(newZoom, newRefPoint, event.immediately);

    });
    //unset flag
    self.synchronizing=false;
}

function synchronizingRotateHandler(event){
    //self is the viewer initiating the viewport-change event
    let self = event.eventSource;
    //set flag so other viewer won't send return signal
    self.synchronizing = true;
    //arr is the list of viewers to synchronize with
    let arr = self.synchronizedViewers || [];
    arr.forEach(d=>{
        //(potential) target viewer
        let target = d.viewer;
        let transformMatrix = d.transformMatrix;
        
        if(target.synchronizing) return;
        
        if(!target || !transformMatrix){
            console.error('synchronizingViewer data not properly formed');
            return;
        }
        let degrees = event.degrees;
        let newDegrees = degrees - transformMatrix.rotation;
        let refPoint = event.pivot || self.viewport.getCenter();
        let transformed = transformMatrix.transform(new paper.Point(refPoint.x, refPoint.y));
        let newRefPoint = new OpenSeadragon.Point(transformed.x, transformed.y);
        target.viewport.rotateTo(newDegrees, newRefPoint, event.immediately);
    });
    //unset flag
    self.synchronizing=false;
}

function setupImagePicker(cases){
    $('#open-select-images').on('click',()=>$('.select-images').dialog('open'));
    $('.select-images').dialog({title:'Pick images to sync',width:'auto',autoOpen:false,});
    $('.select-images').on('click', '.case-name', ev=>{
        $(ev.currentTarget).closest('.case').find('.blocklist').toggleClass('collapsed');
    }).on('click','.thumbnail',ev=>{
        let d = $(ev.currentTarget).data();
        d.viewer.open(d.block.tileSource);
    })
    let imagePicker=$('.image-picker').empty();
    Object.keys(cases).forEach(name=>{
        let blocks = cases[name].blocks;
        let c = $('<div>',{class:'case'});
        $('<div>',{class:'case-name'}).text(name).appendTo(c);
        let blocklist=$('<div>',{class:'blocklist'}).appendTo(c);
        Object.keys(blocks).sort((a,b)=>a.length - b.length || a.localeCompare(b)).forEach(blockKey=>{
            $('<span>',{class:'block-name'}).appendTo(blocklist).text(blockKey);
            let staticList=$('<span>',{class:'slidelist'}).appendTo(blocklist);
            let movingList=$('<span>',{class:'slidelist'}).appendTo(blocklist);
            blocks[blockKey].forEach(block=>{
                $('<img>',{class:'thumbnail',title:block.meta.stain,src:block.tileSource.thumbnailUrl}).appendTo(staticList).data({viewer:staticViewer, block: block});
                $('<img>',{class:'thumbnail',title:block.meta.stain,src:block.tileSource.thumbnailUrl}).appendTo(movingList).data({viewer:movingViewer, block: block});
            })
        });
        imagePicker.append(c);
    })
}
function makeViewer(id, tileSource){
    return new OpenSeadragon({
        id: id,
        tileSources: tileSource,
        crossOriginPolicy:'Anonymous',
        prefixUrl:'/node_modules/openseadragon/build/openseadragon/images/',
        maxZoomPixelRatio: 10,
        minZoomImageRatio: 0.2,
        visibilityRatio: 0,
        subPixelRoundingForTransparency: {'*': OpenSeadragon.SUBPIXEL_ROUNDING_OCCURRENCES.ALWAYS},
    });
}
function getGlassColor(tileSource){
    let thumbUrl = tileSource.thumbnailUrl || tileSource.getTileUrl(1,1,1).replace(/\/tiles\/.*/, '/tiles/thumbnail');
    let image = new Image();
    image.crossOrigin = "Anonymous";
    return new Promise((resolve,reject)=>{
        image.onload = function(){
            let w = this.width;
            let h = this.height;
            let canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            let context = canvas.getContext("2d",{willReadFrequently: true});
            context.drawImage(this, 0, 0);

            let left = context.getImageData(0, 0, 1, h);
            let top = context.getImageData(0, 0, w, 1);
            let right = context.getImageData(w-1, 0, 1, h);
            let bottom = context.getImageData(0, h-1, w, 1);

            let length = left.height + top.width + right.height + bottom.width;
            let red = new Array(length);
            let green = new Array(length);
            let blue = new Array(length); 
            let a=0;
            [left, top, right, bottom].forEach(edge=>{
                for(var i=0; i<edge.data.length; i+=4, a+=1){
                    red[a] = edge.data[i];
                    green[a] = edge.data[i+1];
                    blue[a] = edge.data[i+2];
                }
            });

            let medianRed = red.sort()[Math.floor(red.length/2)];
            let medianGreen = green.sort()[Math.floor(green.length/2)];
            let medianBlue = blue.sort()[Math.floor(blue.length/2)];

            let maxDifference = [left, top, right, bottom].map(edge=>{
                let diff = new Array(edge.data.length/4);
                for(var i=0; i<edge.data.length; i+=4, a+=1){
                    diff[a] = Math.max(Math.abs(edge.data[i] - medianRed), Math.abs(edge.data[i+1] - medianGreen), Math.abs(edge.data[i+2] - medianBlue));
                }
                return diff;
            }).flat().sort();
            
            resolve({red: medianRed, green: medianGreen, blue: medianBlue, maxDifference: maxDifference});
        };
        image.onerror = reject;
        image.src = thumbUrl;
    });
}
function enableTransparentBackground(viewer, tolerance, alpha){
    let tileSource = viewer.world.getItemAt(0).source;
    let background = tileSource.backgroundColor;
    if(!background){
        return;
    }

    tileSource.hasTransparency = ()=>true; 
    
    $(viewer.element).addClass('transparent-glass');
    viewer.setFilterOptions({
        filters: {
            processors: [
                function(context, callback) {
                    let imData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
                    
                    let newImData = imData;
                    for(var i=0; i<newImData.data.length; i+=4){
                        if(Math.abs(newImData.data[i] - background.red)<tolerance &&
                           Math.abs(newImData.data[i+1] - background.green)<tolerance  &&
                           Math.abs(newImData.data[i+2] - background.blue)<tolerance ){
                            newImData.data[i+3] = alpha;
                        }
                    }

                    context.putImageData(newImData, 0, 0);

                    //make the callback async so the tile cache works appropriately
                    window.setTimeout(()=>callback(context));
                    
                },
            ]
        },
    });
}
function disableTransparentBackground(viewer){
    viewer.world.getItemAt(0).source.hasTransparency = ()=>false; 
    $(viewer.element).removeClass('transparent-glass');
    viewer.setFilterOptions({
        filters:{
            processors:[]
        }
    })
}
