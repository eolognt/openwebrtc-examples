console.log('Let\'s play');
var canvas = document.querySelector('canvas');
var ctx = canvas.getContext('2d');
ctx.canvas.width = window.innerWidth;
ctx.canvas.height = window.innerHeight - 50;

var getNodePosition = function (node) {
    var top = 0;
    var left = 0;
    while (node) {
        if (node.tagName) {
            top = top + node.offsetTop;
            left = left + node.offsetLeft;
            node = node.offsetParent;
        } else {
            node = node.parentNode;
        }
    }
    return {top: top, left: left};
};

var communice = function (message) {
    ctx.font = "32px Helvetica";
    ctx.fillStyle = 'black';
    ctx.fillText(message, ctx.canvas.width / 2, ctx.canvas.height / 2);
};

var relToCanvas = function (x, y) {
    var new_x = x - getNodePosition(canvas).left;
    var new_y = y - getNodePosition(canvas).top;

    return {x: new_x, y: new_y};
};
var drawRect = function (x, y, rotation, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.rect(-10, -15, 20, 10);
    ctx.rect(-10, 5, 20, 10);
    ctx.restore();
    ctx.fill();
};

var drawCircle = function (x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
};

var bullets = [];
var key = {};

var Game = function () {
    var draw = function () {
        document.addEventListener('mousemove', function (event) {
            var pos = relToCanvas(event.x, event.y);
            drawCircle(pos.x, pos.y, 5);
            sendPos(event.x, event.y);
        });
    };

    var frames = 0;
    this.channelEvent = undefined;

    this.registerChannel = function (channel) {
        this.channel = channel;
        var self = this;
        this.channel.onmessage = function (event) {
            self.getPeerMove(event);
        };
    };

    this.registerOpponent = function (name, position) {
        this.opponent = new Tank(position.x, position.y, {}, name, true);
        this.tanks.push(this.opponent);
    };

    this.init = function () {
        this.player = new Tank(100, 100, {right: 39, left: 37, up: 38, down: 40, shoot: 32}, 'adf', false);
        this.tanks = [];
        this.enemyBullets = [];
        this.tanks.push(this.player);
        var self = this;

        var gameloop = setInterval(function () {
            self.onmove();

            frames++;
            ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
            for (var j = 0; j < self.tanks.length; j++) {
                self.tanks[j].render();
                for (var m = j + 1; m < self.tanks.length; m++) {
                    if (HitBox.testCircleCircle(self.tanks[j].hitbox, self.tanks[m].hitbox)) {
                        console.log('Colliding tanks');
                    }
                }
                for (var n = 0; n < bullets.length; n++) {
                    if (bullets[n].sender !== self.tanks[j].name && HitBox.testCircleCircle(self.tanks[j].hitbox, bullets[n].hitbox)) {
                        self.tanks[j].power--;
                        bullets.splice(n, 1);
                        n--;
                    }
                }
                for (n = 0; n < self.enemyBullets.length; n++) {
                    if (self.enemyBullets[n].sender !== self.tanks[j].name && HitBox.testCircleCircle(self.tanks[j].hitbox, self.enemyBullets[n].hitbox)) {
                        self.tanks[j].power--;
                        self.enemyBullets.splice(n, 1);
                        n--;
                    }
                }
                if (self.tanks[j].power <= 0) {
                    if (self.tanks[j] === self.player) {
                        console.log('You lost!');
                        communice('You lost!');

                    } else {
                        console.log('You won!');
                        communice('You won!');
                    }
                    clearInterval(gameloop);
                }
            }
            var i;
            for (i = 0; i < bullets.length; i++){
                if (bullets[i].outOfBound(ctx.canvas.width, ctx.canvas.height)) {
                    bullets.splice(i, 1);
                    i--;
                } else {
                    bullets[i].render();
                }
            }
            for (i = 0; i < self.enemyBullets.length; i++){
                if (self.enemyBullets[i].outOfBound(ctx.canvas.width, ctx.canvas.height)) {
                    self.enemyBullets.splice(i, 1);
                    i--;
                } else {
                    self.enemyBullets[i].render();
                }
            }
        }, 50);


        document.onkeydown = document.onkeyup = function (event) {
            event.preventDefault();
            key[event.keyCode] = event.type === 'keydown';

            if (event.keyCode === 81) {
                clearInterval(gameloop);
            }
        };

        this.start = function () {
            bullets = [];
        };
    };

    this.onmove = function () {
        if (this.channel) {
            var data = this.player.sendData();
            data.timestamp = new Date();
            data.bullets = bullets;
            this.channel.send(JSON.stringify(data));
        }
    };

    this.getPeerMove = function (messageEvent) {
        var pack = JSON.parse(messageEvent.data);
        this.opponent.update(pack.x, pack.y, pack.direction);
        this.enemyBullets = [];
        for (var i = 0; i < pack.bullets.length; i++) {
            this.enemyBullets.push(new Bullet(pack.bullets[i].x, pack.bullets[i].y, pack.bullets[i].direction, this.opponent.name));
        }
    };
};

var HitBox = function (x, y, r) {
    this.x = x || 0;
    this.y = y || 0;
    this.r = r;

    this.move = function (x, y) {
        this.x += x;
        this.y += y;
    };
};
HitBox.testCircleCircle = function (circle1, circle2) {
    var d = Math.sqrt(Math.pow((circle1.x - circle2.x), 2) + Math.pow((circle1.y - circle2.y), 2));
    return d <= circle1.r + circle2.r;
};

var Tank = function (x, y, keyset, name, computer) {
    var initialPower = 10;
    // rel to canvas
    this.name = name;
    this.power = initialPower;
    this.x = x;
    this.y = y;
    this.keyset = keyset;
    this.computer = computer;

    this.hitbox = new HitBox(this.x, this.y, 18);

    this.direction = 0;
    this.speed = 5;
    this.turnSpeed = 1 / 20;
    this.lastspace = false;
    this.color = computer ? 'black' : 'grey';

    Object.defineProperty(this, 'bodyColor', {
        get: function () {
            return 'rgba(0, 0, 0, ' + this.power / initialPower + ')';
        }
    });

    this.update = function (x, y, direction) {
        this.x = x;
        this.y = y;
        this.hitbox.x = x;
        this.hitbox.y = y;
        if (direction) {
            this.direction = direction;
        }
    };

    this.sendData = function () {
        return {
            x: this.x,
            y: this.y,
            direction: this.direction
        };
    };

    this.shoot = function () {
        bullets.push(new Bullet(this.x, this.y, this.direction, this.name));
    };
    this.turn = function (direction) {
        if (direction === 'ccw') {
            this.direction = (this.direction - Math.PI * this.turnSpeed) % (2 * Math.PI);
        } else if (direction === 'cw') {
            this.direction = (this.direction + Math.PI * this.turnSpeed) % (2 * Math.PI);
        }
    };
    this.move = function (direction) {
            if (direction === 'forward') {
                var diffY;
                var diffX;
                diffY = Math.sin(this.direction) * this.speed;
                diffX = Math.cos(this.direction) * this.speed;
                this.y = this.y + diffY;
                this.x = this.x + diffX;
                this.hitbox.move(diffX, diffY);
            } else {
                var diffY;
                var diffX;
                diffY = Math.sin(this.direction) * this.speed * 2;
                diffX = Math.cos(this.direction) * this.speed * 2;
                this.y = this.y - diffY;
                this.x = this.x - diffX;
                this.hitbox.move(-diffX, -diffY);
            }
    };
    this.render = function () {
        if (key[this.keyset.right]) { // Right arrow key
            this.turn('cw');
        } else if (key[this.keyset.left]) { // Left arrow key
            this.turn('ccw');
        }
        if (key[this.keyset.shoot] !== this.lastspace) { // Space
            this.lastspace = key[this.keyset.shoot];
            this.shoot();
        }
        if (key[this.keyset.up]) { // Up arrow key
            this.move('forward');
        } else if (key[this.keyset.down]) { // Down arrow key
            this.move('backward');
        }
        var x = Math.floor(this.x);
        var y = Math.floor(this.y);

        drawCircle(x, y, 3, this.bodyColor);
        drawRect(x, y, this.direction, this.color);
    };
};

var Bullet = function (x, y, direction, sender) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.sender = sender;

    this.hitbox = new HitBox(this.x, this.y, 2);

    this.speed = 10;


};
Bullet.prototype.render = function () {
    this.move();
    drawCircle(this.x, this.y, 2);
};
Bullet.prototype.move = function () {
    var diffX = Math.cos(this.direction) * this.speed;
    var diffY = Math.sin(this.direction) * this.speed;
    this.y = this.y + diffY;
    this.x = this.x + diffX;
    this.hitbox.move(diffX, diffY);
};
Bullet.prototype.outOfBound = function (width, height) {
    var out = this.x < 0 || this.x > width || this.y < 0 || this.y > height;
    if (out) {
        console.log(this.x, this.y, 'out');
    } 
    return out;
};
