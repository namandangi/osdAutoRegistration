// import {AnnotationToolkit} from '/node_modules/osd-paperjs-annotation/js/annotationtoolkit.mjs';
import {RotationControlOverlay} from '/node_modules/osd-paperjs-annotation/js/rotationcontrol.mjs';
// let DSA = window.DSA;
let dsaItems = window.App.dsaItems;
console.log('Loaded dsaItems:',dsaItems);


// let tilesource1 = dsaItems[3].tileSource;
// let tilesource2 = dsaItems[4].tileSource;

// let drawingCanvas = document.createElement('canvas');

// console.log(dsaItems)

// tilesource1.hasTransparency = ()=>true; //do this before makeViewer so it is included in TileSource object
// tilesource2.hasTransparency = ()=>true; //do this before makeViewer so it is included in TileSource object
// let staticViewer = window.viewer1 = makeViewer('viewer-static', tilesource1);
// let movingViewer = window.viewer2 = makeViewer('viewer-moving', tilesource2);

// constants
const transparentGlassRGBThreshold = 10;

let staticViewer = window.viewer1 = makeViewer('viewer-static');
let movingViewer = window.viewer2 = makeViewer('viewer-moving');
staticViewer.synchronizedViewers = [{viewer:movingViewer}];
movingViewer.synchronizedViewers = [{viewer:staticViewer}];
staticViewer.world.addHandler('add-item',onImageAdded);
movingViewer.world.addHandler('add-item',onImageAdded);
staticViewer.world.addHandler('remove-item',unsynchronize);
movingViewer.world.addHandler('remove-item',unsynchronize);
staticViewer.rotationControl = new RotationControlOverlay(staticViewer);
movingViewer.rotationControl = new RotationControlOverlay(movingViewer);

setupInfoHandler(staticViewer, $('.image-info.static'));
setupInfoHandler(movingViewer, $('.image-info.moving'));

App.createImagePicker(staticViewer, movingViewer, $('#imagePickerButton'));


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

function onImageAdded(event){
    let viewer = event.eventSource.viewer;
    
    let tileSource = event.item.source;
    if(tileSource.backgroundColor){
        $(viewer.element).css('--background-color',`rgb(${color.red}, ${color.green}, ${color.blue})`);
    } else {
         getGlassColor(tileSource).then(color=>{
            tileSource.backgroundColor = color;
            //make sure we're still viewing this tile source before updating the viewer background color
            if(viewer.world.getIndexOfItem(event.item) !== -1){
                $(viewer.element).css('--background-color',`rgb(${color.red}, ${color.green}, ${color.blue})`);
            }  
        });
    }

    initializeSynchronizeBehavior();
   
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

    // setupSyncInfoHandler(staticViewer, $('.image-info.matrix'));
    // setupSyncInfoHandler(movingViewer, $('.image-info.matrix'));
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

        updateSyncInfoDisplay(true);
    } else {
        staticViewer.removeHandler('pan',synchronizingPanHandler);
        movingViewer.removeHandler('pan',synchronizingPanHandler);

        staticViewer.removeHandler('rotate',synchronizingRotateHandler);
        movingViewer.removeHandler('rotate',synchronizingRotateHandler);

        staticViewer.addHandler('pan', setSynchronizingMatrices);
        movingViewer.addHandler('pan', setSynchronizingMatrices);
        
        staticViewer.addHandler('rotate', setSynchronizingMatrices);
        movingViewer.addHandler('rotate', setSynchronizingMatrices);

        updateSyncInfoDisplay(false);
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

function setupInfoHandler(viewer, container){
    let x = container.find('.x');
    let y = container.find('.y');
    let r = container.find('.rotation');
    let handler= function(event){
        // console.log('viewport-change', event, viewer, container);
        let center = viewer.viewport.getCenter(true);
        let rotation = viewer.viewport.getRotation(true);
        x.val(center.x);
        y.val(center.y);
        r.val(rotation);
    };
    let events = ['pan','zoom','rotate','resize'];
    events.forEach(event=>viewer.addHandler(event, handler));

    let doPan = function(){
        viewer.viewport.panTo(new OpenSeadragon.Point(Number(x.val()), Number(y.val())), true);
    }
    let doRotate = function(){
        viewer.viewport.rotateTo(Number(r.val()), null, true);
    }
    x.on('change', doPan);
    y.on('change', doPan);
    r.on('change', doRotate);

    //Add mouse tracker to OSD viewer element to watch cursor position
    let imageName = container.find('.image-name').text();
    let coordsContainer = $('.cursor-info');
    let targetElement = coordsContainer.find('.cursor-target');
    let vx = coordsContainer.find('.viewport-coords .x');
    let vy = coordsContainer.find('.viewport-coords .y');
    let ix = coordsContainer.find('.image-coords .x');
    let iy = coordsContainer.find('.image-coords .y');
    let mouseCoords = function(event){
        targetElement.text(imageName);
        let viewport = viewer.viewport.viewerElementToViewportCoordinates(event.position);
        let image = viewer.viewport.viewerElementToImageCoordinates(event.position);
        vx.val(viewport.x);
        vy.val(viewport.y);
        ix.val(image.x);
        iy.val(image.y);
    }
    let leaveHandler = function(event){
        targetElement.text('');
        vx.val('');
        vy.val('');
        ix.val('');
        iy.val('');
    }
    new window.OpenSeadragon.MouseTracker({element: viewer.element, moveHandler: mouseCoords, leaveHandler: leaveHandler});
}
// function setupSyncInfoHandler(viewer, container){
//     let x = container.find('.x');
//     let y = container.find('.y');
//     let r = container.find('.rotation');
//     let z = container.find('.zoom');
//     let handler= function(){
//         //defer to the next event loop so the synchronization handler can execute first
//         window.setTimeout(()=>{
//             let synced = viewer.synchronizedViewers && viewer.synchronizedViewers[0];
//             if(synced){
//                 let m = synced.transformMatrix;
//                 let offset = m.translation;
//                 let rotation = m.rotation;
//                 let scaling = m.scaling;
                
//                 x.val(offset.x);
//                 y.val(offset.y);
//                 r.val(rotation);
//                 z.val(scaling.x);
//             } else {
//                 x.val('');
//                 y.val('');
//                 r.val('');
//                 z.val('');
//             }
            
//         });
//     };

//     let events = ['pan','zoom','rotate','resize'];
//     events.forEach(event=>viewer.addHandler(event, handler));
//     handler();
// }

function updateSyncInfoDisplay(isSynced){

    let container = $('.image-info.matrix');
    let viewer = movingViewer;

    let x = container.find('.x');
    let y = container.find('.y');
    let r = container.find('.rotation');
    let z = container.find('.zoom');
    // let handler= function(){
    //     //defer to the next event loop so the synchronization handler can execute first
    //     window.setTimeout(()=>{
            if(isSynced){
                let synced = viewer.synchronizedViewers && viewer.synchronizedViewers[0];
            
                let m = synced.transformMatrix;
                let offset = m.translation;
                let rotation = m.rotation;
                let scaling = m.scaling;
                
                x.val(offset.x);
                y.val(offset.y);
                r.val(rotation);
                z.val(scaling.x);
            } else {
                x.val('');
                y.val('');
                r.val('');
                z.val('');
            }
            
    //     });
    // };

    // let events = ['pan','zoom','rotate','resize'];
    // events.forEach(event=>viewer.addHandler(event, handler));
    // handler();
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



$('.create-viewport-images').on('click',()=>{
    let targetContainer = $('.viewport-image-container');
    targetContainer.empty();
    // let bgImgs = $('.background-images img').toArray();
    createROIImages(targetContainer);
    $('.download-images').attr('disabled',false);
    
});

$('.download-images').on('click',function(){
    let zip = new JSZip();
    // let transformInfo = [];
    let files = $('.image-sets .static-image').toArray().map((staticImg,idx)=>{
        let prefix = 'viewport';
        let movingImg= $(staticImg).data('moving');
        let staticName = prefix + '-static.png';
        let movingName = prefix + '-moving.png';
        
        return Promise.all([
            fetch(staticImg.src).then(response=>response.arrayBuffer()).then(ab=>{
                return zip.file(staticName, ab, {base64: true});
            }),
            fetch(movingImg.src).then(response=>response.arrayBuffer()).then(ab=>{
                return zip.file(movingName, ab, {base64: true});
            }),
        ]);
    });
    // zip.file('info.json',JSON.stringify(transformInfo));
    Promise.all(files).then(()=>{
        zip.generateAsync({type:"blob"}).then(function(content) {
            // see FileSaver.js
            window.saveAs(content, "image-set.zip");
        });
    });
});

function createROIImages(targetContainer){

    movingViewer.viewport.goHome(true);
    staticViewer.viewport.goHome(true);
    
    // let staticImageData = getImageRect(staticViewer, 'image/png');
    let staticImage = $('<img>',{src:getImageUrl(staticViewer, 'image/png'), class:'static-image'}).appendTo(targetContainer);

    // let movingImageData = getImageRect(movingViewer, 'image/png');
    let movingImage = $('<img>',{src:getImageUrl(movingViewer, 'image/png'), class:'moving-image'}).appendTo(targetContainer);

    staticImage.data({moving:movingImage[0],static:staticImage[0]});
    movingImage.data({moving:movingImage[0],static:staticImage[0]});
}

function getImageUrl(viewer, type='image/jpg'){
    return viewer.drawer.canvas.toDataURL(type);
}