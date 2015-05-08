var isMozilla = window.mozRTCPeerConnection && !window.webkitRTCPeerConnection;
if (isMozilla) {
    window.webkitURL = window.URL;
    navigator.webkitGetUserMedia = navigator.mozGetUserMedia;
    window.webkitRTCPeerConnection = window.mozRTCPeerConnection;
    window.RTCSessionDescription = window.mozRTCSessionDescription;
    window.RTCIceCandidate = window.mozRTCIceCandidate;
}

var selfView;
var remoteView;
var callButton;
var audioCheckBox;
var videoCheckBox;
var audioOnlyView;
var signalingChannel;
var pc;
var peer;
var localStream;
var chatDiv;
var chatText;
var chatButton;
var chatCheckBox;
var channel;
var callButton

var sessionId = 'tanks';

// must use 'url' here since Firefox doesn't understand 'urls'
var configuration = {
  "iceServers": [
  {
    "url": "stun:mmt-stun.verkstad.net"
  },
  {
    "url": "turn:mmt-turn.verkstad.net",
    "username": "webrtc",
    "credential": "secret"
  }
  ]
};
window.onload = function () {
    callButton = document.getElementById("call_but");
    var joinButton = document.getElementById("join_but");


        peerJoin();

        function peerJoin() {
            var sessionId = sessionId;
            signalingChannel = new SignalingChannel(sessionId);

            callButton.onclick = function () {
                start(true);
            };

            // another peer has joined our session
            signalingChannel.onpeer = function (evt) {

                callButton.disabled = false;

                peer = evt.peer;
                peer.onmessage = handleMessage;

                peer.ondisconnect = function () {
                    callButton.disabled = true;
                    if (pc)
                        pc.close();
                    pc = null;
                };
            };
        }
};

// handle signaling messages received from the other peer
function handleMessage(evt) {
    var message = JSON.parse(evt.data);

    if (!pc && (message.sdp || message.candidate))
        start(false);

    if (message.sdp) {
        var desc = new RTCSessionDescription(message.sdp);
        pc.setRemoteDescription(desc, function () {
            // if we received an offer, we need to create an answer
            if (pc.remoteDescription.type == "offer")
                pc.createAnswer(localDescCreated, logError);
        }, logError);
    } else if (!isNaN(message.orientation) && remoteView) {
        var transform = "rotate(" + message.orientation + "deg)";
        remoteView.style.transform = remoteView.style.webkitTransform = transform;
    } else
        pc.addIceCandidate(new RTCIceCandidate(message.candidate), function () {}, logError);
}

// call start() to initiate
var g;
function start(isInitiator) {
    g = new Game();
    g.init();
    callButton.disabled = true;
    pc = new webkitRTCPeerConnection(configuration);

    // send any ice candidates to the other peer
    pc.onicecandidate = function (evt) {
        if (evt.candidate) {
            peer.send(JSON.stringify({ "candidate": evt.candidate }));
            console.log("candidate emitted: " + evt.candidate.candidate);
        }
    };

    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function () {
        // check signaling state here because Chrome dispatches negotiationeeded during negotiation
        if (pc.signalingState == "stable")
            pc.createOffer(localDescCreated, logError);
    };

    // start the chat
        if (isInitiator) {
            channel = pc.createDataChannel("chat");
            setupChat(true);
        } else {
            pc.ondatachannel = function (evt) {
                channel = evt.channel;
                setupChat(false);
            };
        }

    // once the remote stream arrives, show it in the remote video element
    pc.onaddstream = function (evt) {
        remoteView.src = URL.createObjectURL(evt.stream);
        if (videoCheckBox.checked)
            remoteView.style.visibility = "visible";
        else if (audioCheckBox.checked && !(chatCheckBox.checked))
            audioOnlyView.style.visibility = "visible";
        sendOrientationUpdate();
    };

    // the negotiationneeded event is not supported in Firefox
    if (isMozilla && isInitiator)
        pc.onnegotiationneeded();
}

function localDescCreated(desc) {
    pc.setLocalDescription(desc, function () {
        peer.send(JSON.stringify({ "sdp": pc.localDescription }));
        console.log("localDescription set and sent to peer, type: " + pc.localDescription.type + ", sdp: " + pc.localDescription.sdp);
    }, logError);
}

function logError(error) {
    if (error) {
        if (error.name && error.message)
            log(error.name + ": " + error.message);
        else
            log(error);
    } else
        log("Error (no error message)");
}

// setup chat
function setupChat(isInitiator) {
    channel.onopen = function () {
        g.registerChannel(channel);
        if (isInitiator) {
            g.player.update(100, 200);
            g.registerOpponent('not', {x: 100, y: 100});
        } else {
            g.player.update(100, 100);
            g.registerOpponent('initiator', {x: 100, y: 200});
        }
        g.start();
    };
}
