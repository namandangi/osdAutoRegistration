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

let drawingCanvas = document.createElement('canvas');

let staticViewer = window.viewer1 = makeViewer('viewer-static');
let movingViewer = window.viewer2 = makeViewer('viewer-moving');
staticViewer.synchronizedViewers = [{viewer:movingViewer}];
movingViewer.synchronizedViewers = [{viewer:staticViewer}];
staticViewer.addHandler('open',onImageOpen);
movingViewer.addHandler('open',onImageOpen);
staticViewer.addHandler('close',unsynchronize);
movingViewer.addHandler('close',unsynchronize);
staticViewer.rotationControl = new RotationControlOverlay(staticViewer);
movingViewer.rotationControl = new RotationControlOverlay(movingViewer);

setupImagePicker(cases);

$('#sanity-check-dialog').dialog({autoOpen:false,width:'auto',height:'auto',title:'Sanity check. Are images aligned?'});

$('input.opacity-slider').on('input',function(){
    $('.openseadragon-canvas').css('--stacked-opacity',this.value/100);
}).trigger('input');

$('input.glass-checkbox').on('change',function(){
    if(this.checked){
        enableTransparentBackground(staticViewer, transparentGlassRGBThreshold, 0);
        enableTransparentBackground(movingViewer, transparentGlassRGBThreshold, 0);
        // $('.create-viewport-images').attr('disabled',false);
        // $('.create-background-images').attr('disabled',true);
    } else {
        disableTransparentBackground(staticViewer);
        disableTransparentBackground(movingViewer);
        // $('.create-viewport-images').attr('disabled',true);
        // $('.create-background-images').attr('disabled',false);
    }
}).prop('checked',false);

$('input.combine-checkbox').on('change',function(){
    //unsync zoom until the initial rescaling is 
    staticViewer.removeHandler('zoom',synchronizingZoomHandler);
    movingViewer.removeHandler('zoom',synchronizingZoomHandler);
    let staticResizeFinished = false;
    let movingResizeFinished = false;
    staticViewer.addOnceHandler('resize',()=>{
        staticResizeFinished = true;
        if(staticResizeFinished && movingResizeFinished){
            window.setTimeout( ()=> {
                staticViewer.addHandler('zoom',synchronizingZoomHandler);
                movingViewer.addHandler('zoom',synchronizingZoomHandler);
                setSynchronizingMatrices();
            });
        }
    });
    movingViewer.addOnceHandler('resize',()=>{
        movingResizeFinished = true;
        if(staticResizeFinished && movingResizeFinished){
            window.setTimeout( ()=> {
                staticViewer.addHandler('zoom',synchronizingZoomHandler);
                movingViewer.addHandler('zoom',synchronizingZoomHandler);
                setSynchronizingMatrices();
            });
        }
    });
    if(this.checked){
        $('.viewer-container').addClass('stacked').removeClass('side-by-side');
        staticViewer.rotationControl.deactivate();
    } else {
        $('.viewer-container').addClass('side-by-side').removeClass('stacked');
    }
}).prop('checked',false);

$('input.sync-checkbox').on('change',setSynchronizingStatus).attr('checked',false);

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
        $('.download-images').attr('disabled',false);
    });
});

$('.download-images').on('click',function(){
    let zip = new JSZip();
    let transformInfo = [];
    let files = $('.image-sets .static-image').toArray().map((staticImg,idx)=>{
        let prefix = 'image'+idx;
        let movingImg= $(staticImg).data('moving');
        let transform = $(staticImg).data('transform');
        let staticName = prefix + '-static.png';
        let movingName = prefix + '-moving.png';
        transform.staticImage = staticName;
        transform.movingImage = movingName;
        transformInfo[idx] = transform;
        return Promise.all([
            fetch(staticImg.src).then(response=>response.arrayBuffer()).then(ab=>{
                return zip.file(staticName, ab, {base64: true});
            }),
            fetch(movingImg.src).then(response=>response.arrayBuffer()).then(ab=>{
                return zip.file(movingName, ab, {base64: true});
            }),
        ]);
    });
    zip.file('info.json',JSON.stringify(transformInfo));
    Promise.all(files).then(()=>{
        zip.generateAsync({type:"blob"}).then(function(content) {
            // see FileSaver.js
            window.saveAs(content, "image-sets.zip");
        });
    });
})

$('.image-sets').on('click','img',ev=>{
    let img = $(ev.currentTarget);
    setupSanityCheck(img.data());
    $('#sanity-check-dialog').dialog('open');
})

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

// Get images as-is from ROI
function createImages(targetContainer, remainingIterations, bgImgs=[]){
    let staticImage = getImageRect(staticViewer, bgImgs[0], 'image/png');
    targetContainer.append($('<img>',{src:staticImage, class:'static-image'}));

    let movingImage = getImageRect(movingViewer, bgImgs[1], 'image/png');
    targetContainer.append($('<img>',{src:movingImage, class:'moving-image'}));

    console.log('Background images created');
}
function createTransformedImages(targetContainer, remainingIterations, bgImgs=[]){
    //sync images if necessary
    if(!$('input.sync-checkbox').prop('checked')){
        $('input.sync-checkbox').prop('checked',true).trigger('change');
    }
    let rotation1 = Math.random()*360;
    let rotation2 = Math.random()*360;

    let tx1 = Math.random()*0.2;
    let ty1 = Math.random()*0.2;

    let tx2 = Math.random()*0.2;
    let ty2 = Math.random()*0.2;

    let transform = {
        deltaTheta: rotation2-rotation1,
        deltaXviewport: tx2-tx1,
        deltaYviewport: ty2-ty1,
    };


    let staticImage;
    let movingImage;
    //rotate and translate operation 1 - before getting static image
    staticViewer.viewport.rotateBy(rotation1, null, true);
    staticViewer.viewport.panBy(new OpenSeadragon.Point(tx1, ty1), true);
    let refPoint = staticViewer.viewport.getCenter();
    let refAngle = staticViewer.viewport.getRotation(true);
    //wait for the viewers to update
    let promise = Promise.all([
        new Promise(resolve=>staticViewer.addOnceHandler('update-viewport',()=>resolve())),
        new Promise(resolve=>movingViewer.addOnceHandler('update-viewport',()=>resolve())),
    ]);

    return promise.then( ()=>{
        //get staticImage data in transformed state
        let staticImageData = getImageRect(staticViewer, bgImgs[0], 'image/png');
        staticImage = $('<img>',{src:staticImageData, class:'static-image'}).appendTo(targetContainer);

        //undo operation 1
        staticViewer.viewport.rotateBy(-rotation1, null, true);
        staticViewer.viewport.panBy(new OpenSeadragon.Point(-tx1, -ty1), true);

        //rotate and translate operation 2 - before getting moving image
        staticViewer.viewport.rotateBy(rotation2, null, true);
        staticViewer.viewport.panBy(new OpenSeadragon.Point(tx2, ty2), true);

        let transformedPixels = staticViewer.viewport.viewportToViewerElementCoordinates(staticViewer.viewport.getCenter())
            .minus(staticViewer.viewport.viewportToViewerElementCoordinates(refPoint));
        let transformedAngle = staticViewer.viewport.getRotation(true) - refAngle;
        transform.a = OpenSeadragon.positiveModulo(transformedAngle, 360);
        transform.x = transformedPixels.x;
        transform.y = transformedPixels.y;

        //wait for viewers to update

        let promise = Promise.all([
            new Promise(resolve=>staticViewer.addOnceHandler('update-viewport',()=>resolve())),
            new Promise(resolve=>movingViewer.addOnceHandler('update-viewport',()=>resolve())),
        ]);

        return promise; 

    }).then( ()=>{
        let movingImageData = getImageRect(movingViewer, bgImgs[1], 'image/png');
        movingImage = $('<img>',{src:movingImageData, class:'moving-image'}).appendTo(targetContainer);
        staticImage.data({moving:movingImage[0],static:staticImage[0],transform:transform});
        movingImage.data({moving:movingImage[0],static:staticImage[0],transform:transform});

        //add handlers to wait for viewers to update
        
        //undo operation 2
        staticViewer.viewport.rotateBy(-rotation2, null, true);
        staticViewer.viewport.panBy(new OpenSeadragon.Point(-tx2, -ty2), true);

        let promise = Promise.all([
            new Promise(resolve=>staticViewer.addOnceHandler('update-viewport',()=>resolve())),
            new Promise(resolve=>movingViewer.addOnceHandler('update-viewport',()=>resolve())),
        ]);
        

        return promise;
        
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

function setupSanityCheck(params){
    let transform = params.transform;
    let canvas = $('.sanity-canvas')[0];
    let w = params.static.naturalWidth;
    let h = params.static.naturalHeight;
    canvas.width = w * 2;
    canvas.height = h * 2;
    
    let angleInRadians = -transform.a * Math.PI / 180;
    
    let context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    //translate to center
    context.translate(w, h);
    //draw static image as-is
    context.drawImage(params.static, -w/2, -h/2);
    //set semi-transparent for next draw
    context.globalAlpha = 0.5;
    //rotate the viewport
    context.rotate(angleInRadians);
    //draw moving image rotated and translated
    context.drawImage(params.moving, -w/2 + transform.x, -h/2 + transform.y);
    
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
    // console.log('Setting up sync');
    // console.log(`Static viewer: zoom(${staticViewer.viewport.getZoom()}), mmx(${ts1.mm_x}), w(${ts1.width})`);
    // console.log(`Moving viewer: zoom(${movingViewer.viewport.getZoom()}), mmx(${ts2.mm_x}), w(${ts2.width})`);
    staticViewer.removeHandler('zoom',synchronizingZoomHandler);
    movingViewer.removeHandler('zoom',synchronizingZoomHandler);
    movingViewer.viewport.zoomTo(staticViewer.viewport.getZoom() * (ts2.mm_x * ts2.width) / (ts1.mm_x * ts1.width) );
    console.log(`New zooms: static(${staticViewer.viewport.getZoom()}), moving(${movingViewer.viewport.getZoom()})`);
    setSynchronizingMatrices();

    staticViewer.addHandler('zoom',synchronizingZoomHandler);
    movingViewer.addHandler('zoom',synchronizingZoomHandler);
    staticViewer.addHandler('pan', setSynchronizingMatrices);
    movingViewer.addHandler('pan', setSynchronizingMatrices);
    
    staticViewer.addHandler('rotate', setSynchronizingMatrices);
    movingViewer.addHandler('rotate', setSynchronizingMatrices);
}

function unsynchronize(){
    // console.log('Unsynchronizing')
    $('input.sync-checkbox').prop('checked',false);
    staticViewer.removeHandler('zoom',synchronizingZoomHandler);
    movingViewer.removeHandler('zoom',synchronizingZoomHandler);
    staticViewer.removeHandler('pan', setSynchronizingMatrices);
    movingViewer.removeHandler('pan', setSynchronizingMatrices);
    staticViewer.removeHandler('rotate', setSynchronizingMatrices);
    movingViewer.removeHandler('rotate', setSynchronizingMatrices);
    staticViewer.removeHandler('pan',synchronizingPanHandler);
    movingViewer.removeHandler('pan',synchronizingPanHandler);
    staticViewer.removeHandler('rotate',synchronizingRotateHandler);
    movingViewer.removeHandler('rotate',synchronizingRotateHandler);
}

function setSynchronizingStatus(){
    //`this` is the checkbox that triggers the event
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
        let img = $(ev.currentTarget);
        if(img.hasClass('static')){
            $('.thumbnail.static.selected').removeClass('selected');
        }
        if(img.hasClass('moving')){
            $('.thumbnail.moving.selected').removeClass('selected');
        }
        img.addClass('selected');
        let d = img.data();
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
                $('<img>',{class:'thumbnail static',title:block.meta.stain,src:block.tileSource.thumbnailUrl,loading:'lazy'}).appendTo(staticList).data({viewer:staticViewer, block: block});
                $('<img>',{class:'thumbnail moving',title:block.meta.stain,src:block.tileSource.thumbnailUrl,loading:'lazy'}).appendTo(movingList).data({viewer:movingViewer, block: block});
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
        preserveImageSizeOnResize: true,
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
