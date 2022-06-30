! function(t, e) {
    "object" == typeof exports && "undefined" != typeof module ? e(exports) : "function" == typeof define && define.amd ? define(["exports"], e) : e((t = t || self).window = t.window || {})
}(this, function(t) {
    "use strict";

    function o(t) {
        return Math.round(1e5 * t) / 1e5 || 0
    }

    function p(t, e) {
        return e.totalLength = t.totalLength, t.samples ? (e.samples = t.samples.slice(0), e.lookup = t.lookup.slice(0), e.minLength = t.minLength, e.resolution = t.resolution) : t.totalPoints && (e.totalPoints = t.totalPoints), e
    }
    var A, w = /[achlmqstvz]|(-?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi,
        S = /[\+\-]?\d*\.?\d+e[\+\-]?\d+/gi,
        F = Math.PI / 180,
        j = Math.sin,
        W = Math.cos,
        U = Math.abs,
        Z = Math.sqrt,
        E = Math.atan2,
        P = 1e8;

    function copyRawPath(t) {
        for (var e = [], n = 0; n < t.length; n++) e[n] = p(t[n], t[n].slice(0));
        return p(t, e)
    }

    function transformRawPath(t, e, n, i, s, a, o) {
        for (var r, h, l, c, d, u = t.length; - 1 < --u;)
            for (h = (r = t[u]).length, l = 0; l < h; l += 2) c = r[l], d = r[l + 1], r[l] = c * e + d * i + a, r[l + 1] = c * n + d * s + o;
        return t._dirty = 1, t
    }

    function arcToSegment(t, e, n, i, s, a, o, r, h) {
        if (t !== r || e !== h) {
            n = U(n), i = U(i);
            var l = s % 360 * F,
                c = W(l),
                d = j(l),
                u = Math.PI,
                g = 2 * u,
                p = (t - r) / 2,
                f = (e - h) / 2,
                _ = c * p + d * f,
                m = -d * p + c * f,
                b = _ * _,
                v = m * m,
                y = b / (n * n) + v / (i * i);
            1 < y && (n = Z(y) * n, i = Z(y) * i);
            var A = n * n,
                P = i * i,
                w = (A * P - A * v - P * b) / (A * v + P * b);
            w < 0 && (w = 0);
            var S = (a === o ? -1 : 1) * Z(w),
                C = n * m / i * S,
                x = -i * _ / n * S,
                E = c * C - d * x + (t + r) / 2,
                M = d * C + c * x + (e + h) / 2,
                D = (_ - C) / n,
                k = (m - x) / i,
                T = (-_ - C) / n,
                H = (-m - x) / i,
                R = D * D + k * k,
                N = (k < 0 ? -1 : 1) * Math.acos(D / Z(R)),
                O = (D * H - k * T < 0 ? -1 : 1) * Math.acos((D * T + k * H) / Z(R * (T * T + H * H)));
            isNaN(O) && (O = u), !o && 0 < O ? O -= g : o && O < 0 && (O += g), N %= g, O %= g;
            var I, L = Math.ceil(U(O) / (g / 4)),
                X = [],
                G = O / L,
                B = 4 / 3 * j(G / 2) / (1 + W(G / 2)),
                q = c * n,
                V = d * n,
                z = d * -i,
                Y = c * i;
            for (I = 0; I < L; I++) _ = W(s = N + I * G), m = j(s), D = W(s += G), k = j(s), X.push(_ - B * m, m + B * _, D + B * k, k - B * D, D, k);
            for (I = 0; I < X.length; I += 2) _ = X[I], m = X[I + 1], X[I] = _ * q + m * z + E, X[I + 1] = _ * V + m * Y + M;
            return X[I - 2] = r, X[I - 1] = h, X
        }
    }

    function stringToRawPath(t) {
        function vd(t, e, n, i) {
            c = (n - t) / 3, d = (i - e) / 3, r.push(t + c, e + d, n - c, i - d, n, i)
        }
        var e, n, i, s, a, o, r, h, l, c, d, u, g, p, f, _ = (t + "").replace(S, function(t) {
                var e = +t;
                return e < 1e-4 && -1e-4 < e ? 0 : e
            }).match(w) || [],
            m = [],
            b = 0,
            v = 0,
            y = _.length,
            A = 0,
            P = "ERROR: malformed path: " + t;
        if (!t || !isNaN(_[0]) || isNaN(_[1])) return console.log(P), m;
        for (e = 0; e < y; e++)
            if (g = a, isNaN(_[e]) ? o = (a = _[e].toUpperCase()) !== _[e] : e--, i = +_[e + 1], s = +_[e + 2], o && (i += b, s += v), e || (h = i, l = s), "M" === a) r && (r.length < 8 ? --m.length : A += r.length), b = h = i, v = l = s, r = [i, s], m.push(r), e += 2, a = "L";
            else if ("C" === a) o || (b = v = 0), (r = r || [0, 0]).push(i, s, b + 1 * _[e + 3], v + 1 * _[e + 4], b += 1 * _[e + 5], v += 1 * _[e + 6]), e += 6;
        else if ("S" === a) c = b, d = v, "C" !== g && "S" !== g || (c += b - r[r.length - 4], d += v - r[r.length - 3]), o || (b = v = 0), r.push(c, d, i, s, b += 1 * _[e + 3], v += 1 * _[e + 4]), e += 4;
        else if ("Q" === a) c = b + 2 / 3 * (i - b), d = v + 2 / 3 * (s - v), o || (b = v = 0), b += 1 * _[e + 3], v += 1 * _[e + 4], r.push(c, d, b + 2 / 3 * (i - b), v + 2 / 3 * (s - v), b, v), e += 4;
        else if ("T" === a) c = b - r[r.length - 4], d = v - r[r.length - 3], r.push(b + c, v + d, i + 2 / 3 * (b + 1.5 * c - i), s + 2 / 3 * (v + 1.5 * d - s), b = i, v = s), e += 2;
        else if ("H" === a) vd(b, v, b = i, v), e += 1;
        else if ("V" === a) vd(b, v, b, v = i + (o ? v - b : 0)), e += 1;
        else if ("L" === a || "Z" === a) "Z" === a && (i = h, s = l, r.closed = !0), ("L" === a || .5 < U(b - i) || .5 < U(v - s)) && (vd(b, v, i, s), "L" === a && (e += 2)), b = i, v = s;
        else if ("A" === a) {
            if (p = _[e + 4], f = _[e + 5], c = _[e + 6], d = _[e + 7], n = 7, 1 < p.length && (p.length < 3 ? (d = c, c = f, n--) : (d = f, c = p.substr(2), n -= 2), f = p.charAt(1), p = p.charAt(0)), u = arcToSegment(b, v, +_[e + 1], +_[e + 2], +_[e + 3], +p, +f, (o ? b : 0) + 1 * c, (o ? v : 0) + 1 * d), e += n, u)
                for (n = 0; n < u.length; n++) r.push(u[n]);
            b = r[r.length - 2], v = r[r.length - 1]
        } else console.log(P);
        return (e = r.length) < 6 ? (m.pop(), e = 0) : r[0] === r[e - 2] && r[1] === r[e - 1] && (r.closed = !0), m.totalPoints = A + e, m
    }

    function bezierToPoints(t, e, n, i, s, a, o, r, h, l, c) {
        var d, u = (t + n) / 2,
            g = (e + i) / 2,
            p = (n + s) / 2,
            f = (i + a) / 2,
            _ = (s + o) / 2,
            m = (a + r) / 2,
            b = (u + p) / 2,
            v = (g + f) / 2,
            y = (p + _) / 2,
            A = (f + m) / 2,
            P = (b + y) / 2,
            w = (v + A) / 2,
            S = o - t,
            C = r - e,
            x = U((n - o) * C - (i - r) * S),
            E = U((s - o) * C - (a - r) * S);
        return l || (l = [t, e, o, r], c = 2), l.splice(c || l.length - 2, 0, P, w), h * (S * S + C * C) < (x + E) * (x + E) && (d = l.length, bezierToPoints(t, e, u, g, b, v, P, w, h, l, c), bezierToPoints(P, w, y, A, _, m, o, r, h, l, c + 2 + (l.length - d))), l
    }

    function pointsToSegment(t, e, n) {
        U(t[0] - t[2]) < 1e-4 && U(t[1] - t[3]) < 1e-4 && (t = t.slice(2));
        var i, s, a, r, h, l, c, d, u, g, p, f, _, m, b = t.length - 2,
            v = +t[0],
            y = +t[1],
            A = +t[2],
            P = +t[3],
            w = [v, y, v, y],
            S = A - v,
            C = P - y,
            x = Math.abs(t[b] - v) < .001 && Math.abs(t[b + 1] - y) < .001;
        for (isNaN(n) && (n = Math.PI / 10), x && (t.push(A, P), A = v, P = y, v = t[b - 2], y = t[b - 1], t.unshift(v, y), b += 4), e = e || 0 === e ? +e : 1, h = 2; h < b; h += 2) i = v, s = y, v = A, y = P, A = +t[h + 2], P = +t[h + 3], v === A && y === P || (f = (l = S) * l + (d = C) * d, _ = (S = A - v) * S + (C = P - y) * C, m = (c = A - i) * c + (u = P - s) * u, p = (a = Math.acos((f + _ - m) / Z(4 * f * _))) / Math.PI * e, g = Z(f) * p, p *= Z(_), v === i && y === s || (n < a ? (r = E(u, c), w.push(o(v - W(r) * g), o(y - j(r) * g), o(v), o(y), o(v + W(r) * p), o(y + j(r) * p))) : (r = E(d, l), w.push(o(v - W(r) * g), o(y - j(r) * g)), r = E(C, S), w.push(o(v), o(y), o(v + W(r) * p), o(y + j(r) * p)))));
        return v !== A || y !== P || w.length < 4 ? w.push(o(A), o(P), o(A), o(P)) : w.length -= 2, x && (w.splice(0, 6), w.length = w.length - 6), w
    }

    function simplifyPoints(t, e) {
        var n, i, s, a, o, r, h, l = parseFloat(t[0]),
            c = parseFloat(t[1]),
            d = [l, c],
            u = t.length - 2;
        for (e = Math.pow(e || 1, 2), n = 2; n < u; n += 2) e < (a = l - (i = parseFloat(t[n]))) * a + (o = c - (s = parseFloat(t[n + 1]))) * o && (d.push(i, s), l = i, c = s);
        return d.push(parseFloat(t[u]), parseFloat(t[1 + u])),
            function simplifyStep(t, e, n, i, s) {
                var a, o, r, h, l, c, d, u, g, p, f, _, m = i,
                    b = t[e],
                    v = t[e + 1],
                    y = t[n],
                    A = t[n + 1];
                for (o = e + 2; o < n; o += 2) h = t[o], l = t[o + 1], p = void 0, _ = (g = A) - (d = v), ((f = (u = y) - (c = b)) || _) && (1 < (p = ((h - c) * f + (l - d) * _) / (f * f + _ * _)) ? (c = u, d = g) : 0 < p && (c += f * p, d += _ * p)), m < (r = Math.pow(h - c, 2) + Math.pow(l - d, 2)) && (a = o, m = r);
                i < m && (2 < a - e && simplifyStep(t, e, a, i, s), s.push(t[a], t[a + 1]), 2 < n - a && simplifyStep(t, a, n, i, s))
            }(d, 0, h = d.length - 2, e, r = [d[0], d[1]]), r.push(d[h], d[1 + h]), r
    }

    function getClosestProgressOnBezier(t, e, n, i, s, a, o, r, h, l, c, d, u, g) {
        var p, f, _, m, b = (s - i) / a,
            v = 0,
            y = i;
        for (A = P; y <= s;)(p = (f = (m = 1 - y) * m * m * o + 3 * m * m * y * h + 3 * m * y * y * c + y * y * y * u - e) * f + (_ = m * m * m * r + 3 * m * m * y * l + 3 * m * y * y * d + y * y * y * g - n) * _) < A && (A = p, v = y), y += b;
        return 1 < t ? getClosestProgressOnBezier(t - 1, e, n, Math.max(v - b, 0), Math.min(v + b, 1), a, o, r, h, l, c, d, u, g) : v
    }

    function C(t) {
        var e = t.ownerDocument || t;
        !(D in t.style) && "msTransform" in t.style && (k = (D = "msTransform") + "Origin");
        for (; e.parentNode && (e = e.parentNode););
        if (f = window, y = new R, e) {
            m = (g = e).documentElement, b = e.body, (x = g.createElementNS("http://www.w3.org/2000/svg", "g")).style.transform = "none";
            var n = e.createElement("div"),
                i = e.createElement("div");
            b.appendChild(n), n.appendChild(i), n.style.position = "static", n.style[D] = "translate3d(0,0,1px)", M = i.offsetParent !== n, b.removeChild(n)
        }
        return e
    }

    function I(t) {
        return t.ownerSVGElement || ("svg" === (t.tagName + "").toLowerCase() ? t : null)
    }

    function K(t, e) {
        if (t.parentNode && (g || C(t))) {
            var n = I(t),
                i = n ? n.getAttribute("xmlns") || "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml",
                s = n ? e ? "rect" : "g" : "div",
                a = 2 !== e ? 0 : 100,
                o = 3 === e ? 100 : 0,
                r = "position:absolute;display:block;pointer-events:none;margin:0;padding:0;",
                h = g.createElementNS ? g.createElementNS(i.replace(/^https/, "http"), s) : g.createElement(s);
            return e && (n ? (v = v || K(t), h.setAttribute("width", .01), h.setAttribute("height", .01), h.setAttribute("transform", "translate(" + a + "," + o + ")"), v.appendChild(h)) : (u || ((u = K(t)).style.cssText = r), h.style.cssText = r + "width:0.1px;height:0.1px;top:" + o + "px;left:" + a + "px", u.appendChild(h))), h
        }
        throw "Need document and parent."
    }

    function N(t, e) {
        var n, i, s, a, o, r, h = I(t),
            l = t === h,
            c = h ? T : H,
            d = t.parentNode;
        if (t === f) return t;
        if (c.length || c.push(K(t, 1), K(t, 2), K(t, 3)), n = h ? v : u, h) l ? (a = -(s = function _getCTM(t) {
            var e, n = t.getCTM();
            return n || (e = t.style[D], t.style[D] = "none", t.appendChild(x), n = x.getCTM(), t.removeChild(x), e ? t.style[D] = e : t.style.removeProperty(D.replace(/([A-Z])/g, "-$1").toLowerCase())), n
        }(t)).e / s.a, o = -s.f / s.d, i = y) : (s = t.getBBox(), a = (i = (i = t.transform ? t.transform.baseVal : {}).numberOfItems ? 1 < i.numberOfItems ? function _consolidate(t) {
            for (var e = new R, n = 0; n < t.numberOfItems; n++) e.multiply(t.getItem(n).matrix);
            return e
        }(i) : i.getItem(0).matrix : y).a * s.x + i.c * s.y, o = i.b * s.x + i.d * s.y), e && "g" === t.tagName.toLowerCase() && (a = o = 0), (l ? h : d).appendChild(n), n.setAttribute("transform", "matrix(" + i.a + "," + i.b + "," + i.c + "," + i.d + "," + (i.e + a) + "," + (i.f + o) + ")");
        else {
            if (a = o = 0, M)
                for (i = t.offsetParent, s = t;
                    (s = s && s.parentNode) && s !== i && s.parentNode;) 4 < (f.getComputedStyle(s)[D] + "").length && (a = s.offsetLeft, o = s.offsetTop, s = 0);
            if ("absolute" !== (r = f.getComputedStyle(t)).position && "fixed" !== r.position)
                for (i = t.offsetParent; d && d !== i;) a += d.scrollLeft || 0, o += d.scrollTop || 0, d = d.parentNode;
            (s = n.style).top = t.offsetTop - o + "px", s.left = t.offsetLeft - a + "px", s[D] = r[D], s[k] = r[k], s.position = "fixed" === r.position ? "fixed" : "absolute", t.parentNode.appendChild(n)
        }
        return n
    }

    function O(t, e, n, i, s, a, o) {
        return t.a = e, t.b = n, t.c = i, t.d = s, t.e = a, t.f = o, t
    }
    var g, f, m, b, u, v, y, x, M, e, D = "transform",
        k = D + "Origin",
        T = [],
        H = [],
        R = ((e = Matrix2D.prototype).inverse = function inverse() {
            var t = this.a,
                e = this.b,
                n = this.c,
                i = this.d,
                s = this.e,
                a = this.f,
                o = t * i - e * n || 1e-10;
            return O(this, i / o, -e / o, -n / o, t / o, (n * a - i * s) / o, -(t * a - e * s) / o)
        }, e.multiply = function multiply(t) {
            var e = this.a,
                n = this.b,
                i = this.c,
                s = this.d,
                a = this.e,
                o = this.f,
                r = t.a,
                h = t.c,
                l = t.b,
                c = t.d,
                d = t.e,
                u = t.f;
            return O(this, r * e + l * i, r * n + l * s, h * e + c * i, h * n + c * s, a + d * e + u * i, o + d * n + u * s)
        }, e.clone = function clone() {
            return new Matrix2D(this.a, this.b, this.c, this.d, this.e, this.f)
        }, e.equals = function equals(t) {
            var e = this.a,
                n = this.b,
                i = this.c,
                s = this.d,
                a = this.e,
                o = this.f;
            return e === t.a && n === t.b && i === t.c && s === t.d && a === t.e && o === t.f
        }, e.apply = function apply(t, e) {
            void 0 === e && (e = {});
            var n = t.x,
                i = t.y,
                s = this.a,
                a = this.b,
                o = this.c,
                r = this.d,
                h = this.e,
                l = this.f;
            return e.x = n * s + i * o + h || 0, e.y = n * a + i * r + l || 0, e
        }, Matrix2D);

    function Matrix2D(t, e, n, i, s, a) {
        void 0 === t && (t = 1), void 0 === e && (e = 0), void 0 === n && (n = 0), void 0 === i && (i = 1), void 0 === s && (s = 0), void 0 === a && (a = 0), O(this, t, e, n, i, s, a)
    }

    function getGlobalMatrix(t, e, n, i) {
        if (!t || !t.parentNode || (g || C(t)).documentElement === t) return new R;
        var s = function _forceNonZeroScale(t) {
                for (var e, n; t && t !== b;)(n = t._gsap) && n.uncache && n.get(t, "x"), n && !n.scaleX && !n.scaleY && n.renderTransform && (n.scaleX = n.scaleY = 1e-4, n.renderTransform(1, n), e ? e.push(n) : e = [n]), t = t.parentNode;
                return e
            }(t),
            a = I(t) ? T : H,
            o = N(t, n),
            r = a[0].getBoundingClientRect(),
            h = a[1].getBoundingClientRect(),
            l = a[2].getBoundingClientRect(),
            c = o.parentNode,
            d = !i && function _isFixed(t) {
                return "fixed" === f.getComputedStyle(t).position || ((t = t.parentNode) && 1 === t.nodeType ? _isFixed(t) : void 0)
            }(t),
            u = new R((h.left - r.left) / 100, (h.top - r.top) / 100, (l.left - r.left) / 100, (l.top - r.top) / 100, r.left + (d ? 0 : function _getDocScrollLeft() {
                return f.pageXOffset || g.scrollLeft || m.scrollLeft || b.scrollLeft || 0
            }()), r.top + (d ? 0 : function _getDocScrollTop() {
                return f.pageYOffset || g.scrollTop || m.scrollTop || b.scrollTop || 0
            }()));
        if (c.removeChild(o), s)
            for (r = s.length; r--;)(h = s[r]).scaleX = h.scaleY = 0, h.renderTransform(1, h);
        return e ? u.inverse() : u
    }

    function _() {
        return !1
    }

    function ma(t) {
        t.preventDefault && (t.preventDefault(), t.preventManipulation && t.preventManipulation())
    }

    function na(t) {
        return L.createElementNS ? L.createElementNS("http://www.w3.org/1999/xhtml", t) : L.createElement(t)
    }

    function oa(t, e, n) {
        var i, s = L.createElementNS("http://www.w3.org/2000/svg", t),
            a = /([a-z])([A-Z])/g;
        for (i in (n = n || {}).class = n.class || "path-editor", n) void 0 !== s.style[i] ? s.style[i] = n[i] : s.setAttributeNS(null, i.replace(a, "$1-$2").toLowerCase(), n[i]);
        return e.appendChild(s), s
    }

    function qa(t) {
        return (t.transform && t.transform.baseVal.consolidate() || s).matrix
    }

    function ta(t) {
        return ~~(1e3 * t + (t < 0 ? -.5 : .5)) / 1e3
    }

    function wa(t) {
        if (!t.target._gsSelection && !nt && 100 < tt() - et) {
            for (var e = rt.length; - 1 < --e;) rt[e].deselect();
            rt.length = 0
        }
    }

    function Aa(t, e, n, i) {
        if (t.addEventListener) {
            var s = V[e];
            i = i || {
                passive: !1
            }, t.addEventListener(s || e, n, i), s && e !== s && "pointer" !== s.substr(0, 7) && t.addEventListener(e, n, i)
        } else t.attachEvent && t.attachEvent("on" + e, n)
    }

    function Ba(t, e, n) {
        if (t.removeEventListener) {
            var i = V[e];
            t.removeEventListener(i || e, n), i && e !== i && "pointer" !== i.substr(0, 7) && t.removeEventListener(e, n)
        } else t.detachEvent && t.detachEvent("on" + e, n)
    }

    function Da(t) {
        a = t.touches && _dragCount < t.touches.length, Ba(t.target, "touchend", Da)
    }

    function Ea(t) {
        a = t.touches && _dragCount < t.touches.length, Aa(t.target, "touchend", Da)
    }

    function Fa(e, n) {
        return function(t) {
            return e.call(n, t)
        }
    }

    function Ga(t, e, n) {
        var i = e.vars[t];
        return i && i.call(e.vars.callbackScope || e, n || e), e
    }

    function Ia() {
        z.style.display = "block", z.select(), z.style.display = "none"
    }

    function La(t) {
        var e, n, i = this,
            s = getGlobalMatrix(i.target.parentNode, !0);
        this._matrix = this.target.transform.baseVal.getItem(0).matrix, this._ctm = s, V[t.type] ? (e = -1 !== t.type.indexOf("touch") ? t.currentTarget || t.target : L, Aa(e, "touchend", i._onRelease), Aa(e, "touchmove", i._onMove), Aa(e, "touchcancel", i._onRelease), Aa(L, "touchstart", Ea), Aa(c, "touchforcechange", ma)) : (e = null, Aa(L, "mousemove", i._onMove)), h || Aa(L, "mouseup", i._onRelease), ma(t), Ia(), t.changedTouches ? (t = i.touch = t.changedTouches[0], i.touchID = t.identifier) : t.pointerId ? i.touchID = t.pointerId : i.touch = i.touchID = null, i._startPointerY = i.pointerY = t.pageY, i._startPointerX = i.pointerX = t.pageX, i._startElementX = i._matrix.e, i._startElementY = i._matrix.f, 1 === this._ctm.a && 0 === this._ctm.b && 0 === this._ctm.c && 1 === this._ctm.d ? this._ctm = null : (n = i._startPointerX * this._ctm.a + i._startPointerY * this._ctm.c + this._ctm.e, i._startPointerY = i._startPointerX * this._ctm.b + i._startPointerY * this._ctm.d + this._ctm.f, i._startPointerX = n), i.isPressed = nt = !0, i.touchEventTarget = e, i.vars.onPress && i.vars.onPress.call(i.vars.callbackScope || i, i.pointerEvent)
    }

    function Ma(t) {
        var e, n, i = this,
            s = t;
        if (i._enabled && !a && i.isPressed && t) {
            if (e = (i.pointerEvent = t).changedTouches) {
                if ((t = e[0]) !== i.touch && t.identifier !== i.touchID) {
                    for (n = e.length; - 1 < --n && (t = e[n]).identifier !== i.touchID;);
                    if (n < 0) return
                }
            } else if (t.pointerId && i.touchID && t.pointerId !== i.touchID) return;
            ma(s), i.setPointerPosition(t.pageX, t.pageY), i.vars.onDrag && i.vars.onDrag.call(i.vars.callbackScope || i, i.pointerEvent)
        }
    }

    function Na(t, e) {
        var n = this;
        if (n._enabled && n.isPressed && (!t || null == n.touchID || e || !(t.pointerId && t.pointerId !== n.touchID || t.changedTouches && ! function _hasTouchID(t, e) {
                for (var n = t.length; - 1 < --n;)
                    if (t[n].identifier === e) return !0;
                return !1
            }(t.changedTouches, n.touchID)))) {
            ! function _interacted() {
                et = tt()
            }(), n.isPressed = nt = !1;
            var i, s, a = t,
                o = n.isDragging,
                r = n.touchEventTarget;
            if (r ? (Ba(r, "touchend", n._onRelease), Ba(r, "touchmove", n._onMove), Ba(r, "touchcancel", n._onRelease), Ba(L, "touchstart", Ea)) : Ba(L, "mousemove", n._onMove), h || (Ba(L, "mouseup", n._onRelease), t && t.target && Ba(t.target, "mouseup", n._onRelease)), o ? n.isDragging = !1 : n.vars.onClick && n.vars.onClick.call(n.vars.callbackScope || n, a), t) {
                if ((i = t.changedTouches) && (t = i[0]) !== n.touch && t.identifier !== n.touchID) {
                    for (s = i.length; - 1 < --s && (t = i[s]).identifier !== n.touchID;);
                    if (s < 0) return
                }
                n.pointerEvent = a, n.pointerX = t.pageX, n.pointerY = t.pageY
            }
            return a && !o && n.vars.onDragRelease ? n.vars.onDragRelease.call(n, n.pointerEvent) : (a && ma(a), n.vars.onRelease && n.vars.onRelease.call(n.vars.callbackScope || n, n.pointerEvent)), o && n.vars.onDragEnd && n.vars.onDragEnd.call(n.vars.callbackScope || n, n.pointerEvent), !0
        }
    }

    function Oa(t, e, n, i) {
        var s, a = t[e],
            o = a.length - (a.closed ? 6 : 0),
            r = [];
        for (s = 0; s < o; s += 6) r.push(new ct(n, t, e, s, i));
        return a.closed && (r[0].isClosedStart = !0), r
    }

    function Pa(t, e, n) {
        var i = t[n] - t[e],
            s = t[n + 1] - t[e + 1];
        return Math.sqrt(i * i + s * s)
    }
    var L, h, c, r, l, X, G, d, B, q, V, z, Y, n, $ = /(?:(-)?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi,
        Q = "#4e7fff",
        J = Math.PI / 180,
        tt = Date.now || function() {
            return (new Date).getTime()
        },
        et = 0,
        nt = 0,
        i = {},
        it = [],
        st = {},
        at = [],
        ot = ",",
        rt = [],
        s = {
            matrix: new R
        },
        a = 0,
        ht = ((n = DraggableSVG.prototype).setPointerPosition = function setPointerPosition(t, e) {
            var n, i, s, a, o;
            this.pointerX = t, this.pointerY = e, this._ctm && (o = t * this._ctm.a + e * this._ctm.c + this._ctm.e, e = t * this._ctm.b + e * this._ctm.d + this._ctm.f, t = o), (i = e - this._startPointerY) < 1 && -1 < i && (i = 0), (n = t - this._startPointerX) < 1 && -1 < n && (n = 0), s = (1e3 * (this._startElementX + n) | 0) / 1e3, a = (1e3 * (this._startElementY + i) | 0) / 1e3, this.snap && !G && (st.x = s, st.y = a, this.snap.call(this, st), s = st.x, a = st.y), this.x === s && this.y === a || (this._matrix.f = this.y = a, this._matrix.e = this.x = s, !this.isDragging && this.isPressed && (this.isDragging = !0, Ga("onDragStart", this, this.pointerEvent)))
        }, n.enabled = function enabled(t) {
            return arguments.length ? ((this._enabled = t) ? (h || Aa(this.target, "mousedown", this._onPress), Aa(this.target, "touchstart", this._onPress), Aa(this.target, "click", this._onClick, !0)) : (e = this.isDragging, Ba(this.target, "mousedown", this._onPress), Ba(this.target, "touchstart", this._onPress), Ba(c, "touchforcechange", ma), Ba(this.target, "click", this._onClick), this.touchEventTarget && (Ba(this.touchEventTarget, "touchcancel", this._onRelease), Ba(this.touchEventTarget, "touchend", this._onRelease), Ba(this.touchEventTarget, "touchmove", this._onMove)), Ba(L, "mouseup", this._onRelease), Ba(L, "mousemove", this._onMove), this.isDragging = this.isPressed = !1, e && Ga("onDragEnd", this, this.pointerEvent)), this) : this._enabled;
            var e
        }, n.endDrag = function endDrag(t) {
            this._onRelease(t)
        }, DraggableSVG);

    function DraggableSVG(t, e) {
        this.target = "string" == typeof t ? L.querySelectorAll(t)[0] : t, this.vars = e || {}, this._onPress = Fa(La, this), this._onMove = Fa(Ma, this), this._onRelease = Fa(Na, this), this.target.setAttribute("transform", (this.target.getAttribute("transform") || "") + " translate(0,0)"), this._matrix = qa(this.target), this.x = this._matrix.e, this.y = this._matrix.f, this.snap = e.snap, isNaN(e.maxX) && isNaN(e.minX) ? this._bounds = 0 : (this._bounds = 1, this.maxX = +e.maxX, this.minX = +e.minX), this.enabled(!0)
    }
    var lt, ct = ((lt = Anchor.prototype).onPress = function onPress() {
        Ga("onPress", this)
    }, lt.onClick = function onClick() {
        Ga("onClick", this)
    }, lt.onDrag = function onDrag() {
        var t = this.segment;
        this.vars.onDrag.call(this.vars.callbackScope || this, this, this._draggable.x - t[this.i], this._draggable.y - t[this.i + 1])
    }, lt.onDragEnd = function onDragEnd() {
        Ga("onDragEnd", this)
    }, lt.onRelease = function onRelease() {
        Ga("onRelease", this)
    }, lt.update = function update(t, e, n) {
        t && (this.rawPath = t), arguments.length <= 1 ? (e = this.j, n = this.i) : (this.j = e, this.i = n);
        var i = this.smooth,
            s = this.rawPath[e],
            a = 0 === n && s.closed ? s.length - 4 : n - 2;
        this.segment = s, this.smooth = 0 < n && n < s.length - 2 && Math.abs(Math.atan2(s[n + 1] - s[1 + a], s[n] - s[a]) - Math.atan2(s[n + 3] - s[n + 1], s[n + 2] - s[n])) < .09 ? 2 : 0, this.smooth !== i && this.element.setAttribute("d", this.smooth ? this.editor._circleHandle : this.editor._squareHandle), this.element.setAttribute("transform", "translate(" + s[n] + "," + s[n + 1] + ")")
    }, Anchor);

    function Anchor(t, e, n, i, s) {
        this.editor = t, this.element = oa("path", t._selection, {
            fill: Q,
            stroke: Q,
            strokeWidth: 2,
            vectorEffect: "non-scaling-stroke"
        }), this.update(e, n, i), this.element._gsSelection = !0, this.vars = s || {}, this._draggable = new ht(this.element, {
            callbackScope: this,
            onDrag: this.onDrag,
            snap: this.vars.snap,
            onPress: this.onPress,
            onRelease: this.onRelease,
            onClick: this.onClick,
            onDragEnd: this.onDragEnd
        })
    }
    var dt, ut = ((dt = PathEditor.prototype)._onRelease = function _onRelease(t) {
        var e = this._editingAnchor;
        e && (i.x = e.segment[e.i], i.y = e.segment[e.i + 1]), Ba(c, "touchforcechange", ma), Ga("onRelease", this, t)
    }, dt.init = function init() {
        var t, e, n = this.path.getAttribute("d"),
            i = stringToRawPath(n),
            s = this.path.getAttribute("transform") || "translate(0,0)",
            a = !this._rawPath || i.totalPoints !== this._rawPath.totalPoints || i.length !== this._rawPath.length,
            o = {
                callbackScope: this,
                snap: this.vars.anchorSnap,
                onDrag: this._onDragAnchor,
                onPress: this._onPressAnchor,
                onRelease: this._onRelease,
                onClick: this._onClickAnchor,
                onDragEnd: this._onDragEndAnchor,
                maxX: this.vars.maxX,
                minX: this.vars.minX
            };
        if (a && this._anchors && this._anchors.length) {
            for (e = 0; e < this._anchors.length; e++) this._anchors[e].element.parentNode.removeChild(this._anchors[e].element), this._anchors[e]._draggable.enabled(!1);
            this._selectedAnchors.length = 0
        }
        if (this._rawPath = i, a) {
            if (this._anchors = Oa(i, 0, this, o), 1 < (t = i.length))
                for (e = 1; e < t; e++) this._anchors = this._anchors.concat(Oa(i, e, this, o))
        } else
            for (e = this._anchors.length; - 1 < --e;) this._anchors[e].update(i);
        return this._selection.appendChild(this._handle1), this._selection.appendChild(this._handle2), this._selectionPath.setAttribute("d", n), this._selectionHittest.setAttribute("d", n), this._g.setAttribute("transform", function _getConcatenatedTransforms(t) {
            for (var e = qa(t), n = t.ownerSVGElement;
                (t = t.parentNode) && t.ownerSVGElement === n;) e.multiply(qa(t));
            return "matrix(" + e.a + "," + e.b + "," + e.c + "," + e.d + "," + e.e + "," + e.f + ")"
        }(this.path.parentNode) || "translate(0,0)"), this._selection.setAttribute("transform", s), this._selectionHittest.setAttribute("transform", s), this._updateAnchors(), this
    }, dt._saveState = function _saveState() {
        ! function _addHistory(t) {
            var e, n = [],
                i = t._selectedAnchors;
            for (e = 0; e < i.length; e++) n[e] = i[e].i;
            it.unshift({
                path: t,
                d: t.path.getAttribute("d"),
                transform: t.path.getAttribute("transform") || "",
                selectedIndexes: n
            }), 30 < it.length && (it.length = 30)
        }(this)
    }, dt._onClickSelectionPath = function _onClickSelectionPath(t) {
        if ("hidden" === this._selection.style.visibility) this.select();
        else if (X || t && t.altKey) {
            var e, n, i, s, a, r, h = {
                    callbackScope: this,
                    snap: this.vars.anchorSnap,
                    onDrag: this._onDragAnchor,
                    onPress: this._onPressAnchor,
                    onRelease: this._onRelease,
                    onClick: this._onClickAnchor,
                    onDragEnd: this._onDragEndAnchor,
                    maxX: this.vars.maxX,
                    minX: this.vars.minX
                },
                l = this._selection.getScreenCTM().inverse();
            for (this._draggable && this._draggable._onRelease(t), l && (s = t.clientX * l.a + t.clientY * l.c + l.e, a = t.clientX * l.b + t.clientY * l.d + l.f), r = function getClosestData(t, e, n, i) {
                    var s, a, o, r, h = {
                            j: 0,
                            i: 0,
                            t: 0
                        },
                        l = P;
                    for (a = 0; a < t.length; a++)
                        for (r = t[a], s = 0; s < r.length; s += 6) o = getClosestProgressOnBezier(1, e, n, 0, 1, i || 20, r[s], r[s + 1], r[s + 2], r[s + 3], r[s + 4], r[s + 5], r[s + 6], r[s + 7]), A < l && (l = A, h.j = a, h.i = s, h.t = o);
                    return h
                }(this._rawPath, s, a), function subdivideSegment(t, e, n) {
                    if (n <= 0 || 1 <= n) return 0;
                    var i = t[e],
                        s = t[e + 1],
                        a = t[e + 2],
                        r = t[e + 3],
                        h = t[e + 4],
                        l = t[e + 5],
                        c = i + (a - i) * n,
                        d = a + (h - a) * n,
                        u = s + (r - s) * n,
                        g = r + (l - r) * n,
                        p = c + (d - c) * n,
                        f = u + (g - u) * n,
                        _ = h + (t[e + 6] - h) * n,
                        m = l + (t[e + 7] - l) * n;
                    return d += (_ - d) * n, g += (m - g) * n, t.splice(e + 2, 4, o(c), o(u), o(p), o(f), o(p + (d - p) * n), o(f + (g - f) * n), o(d), o(g), o(_), o(m)), t.samples && t.samples.splice(e / 6 * t.resolution | 0, 0, 0, 0, 0, 0, 0, 0), 6
                }(this._rawPath[r.j], r.i, r.t), e = r.i + 6, n = 0; n < this._anchors.length; n++) this._anchors[n].i >= e && (this._anchors[n].i += 6);
            i = new ct(this, this._rawPath, r.j, e, h), this._selection.appendChild(this._handle1), this._selection.appendChild(this._handle2), i._draggable._onPress(t), B = i, this._anchors.push(i), this._selectedAnchors.length = 0, this._selectedAnchors.push(i), this._updateAnchors(), this.update(), this._saveState()
        }
        Ia(), Aa(c, "touchforcechange", ma), Ga("onPress", this)
    }, dt._onClickHandle1 = function _onClickHandle1() {
        var t = this._editingAnchor,
            e = t.i,
            n = t.segment,
            i = t.isClosedStart ? n.length - 4 : e - 2;
        X && Math.abs(n[e] - n[i]) < 5 && Math.abs(n[e + 1] - n[1 + i]) < 5 && this._onClickAnchor(t)
    }, dt._onClickHandle2 = function _onClickHandle2() {
        var t = this._editingAnchor,
            e = t.i,
            n = t.segment;
        X && Math.abs(n[e] - n[e + 2]) < 5 && Math.abs(n[e + 1] - n[e + 3]) < 5 && this._onClickAnchor(t)
    }, dt._onDragEndAnchor = function _onDragEndAnchor() {
        B = null, this._saveState()
    }, dt.isSelected = function isSelected() {
        return 0 < this._selectedAnchors.length
    }, dt.select = function select(t) {
        if (this._selection.style.visibility = "visible", this._editingAnchor = null, (this.path._gsSelection = !0) === t)
            for (var e = this._anchors.length; - 1 < --e;) this._selectedAnchors[e] = this._anchors[e];
        return -1 === rt.indexOf(this) && rt.push(this), this._updateAnchors(), this
    }, dt.deselect = function deselect() {
        return this._selection.style.visibility = "hidden", this._selectedAnchors.length = 0, this._editingAnchor = null, this.path._gsSelection = !1, rt.splice(rt.indexOf(this), 1), this._updateAnchors(), this
    }, dt._onDragPath = function _onDragPath() {
        var t = this._selectionHittest.getAttribute("transform") || "translate(0,0)";
        this._selection.setAttribute("transform", t), this.path.setAttribute("transform", t)
    }, dt._onPressAnchor = function _onPressAnchor(t) {
        -1 === this._selectedAnchors.indexOf(t) ? (G || (this._selectedAnchors.length = 0), this._selectedAnchors.push(t)) : G && (this._selectedAnchors.splice(this._selectedAnchors.indexOf(t), 1), t._draggable.endDrag()), i.x = t.segment[t.i], i.y = t.segment[t.i + 1], this._updateAnchors(), Ga("onPress", this)
    }, dt._deleteSelectedAnchors = function _deleteSelectedAnchors() {
        for (var t, e, n, i = this._selectedAnchors, s = i.length; - 1 < --s;)
            for ((t = i[s]).element.parentNode.removeChild(t.element), t._draggable.enabled(!1), (e = t.i) ? e < t.segment.length - 2 ? t.segment.splice(e - 2, 6) : t.segment.splice(e - 4, 6) : t.segment.splice(e, 6), i.splice(s, 1), this._anchors.splice(this._anchors.indexOf(t), 1), n = 0; n < this._anchors.length; n++) this._anchors[n].i >= e && (this._anchors[n].i -= 6);
        this._updateAnchors(), this.update(), this._saveState(), this.vars.onDeleteAnchor && this.vars.onDeleteAnchor.call(this.vars.callbackScope || this)
    }, dt._onClickAnchor = function _onClickAnchor(t) {
        var e, n, i, s, a, o, r = t.i,
            h = t.segment,
            l = t.isClosedStart ? h.length - 4 : r - 2,
            c = 1e3,
            d = !r || r >= h.length - 2;
        X && B !== t && this._editingAnchor ? (t.smooth = !t.smooth, d && !t.isClosedStart && (t.smooth = !1), t.element.setAttribute("d", t.smooth ? this._circleHandle : this._squareHandle), !t.smooth || d && !t.isClosedStart ? t.smooth || d && !t.isClosedStart || ((r || t.isClosedStart) && (h[l] = h[r], h[1 + l] = h[r + 1]), r < h.length - 2 && (h[r + 2] = h[r], h[r + 3] = h[r + 1]), this._updateAnchors(), this.update(), this._saveState()) : (e = ((e = Math.atan2(h[r + 1] - h[1 + l], h[r] - h[l])) + (n = Math.atan2(h[r + 3] - h[r + 1], h[r + 2] - h[r]))) / 2, i = Pa(h, l, r), s = Pa(h, r, r + 2), i < .2 && (i = Pa(h, r, l - 4) / 4, e = n || Math.atan2(h[r + 7] - h[l - 3], h[r + 6] - h[l - 4])), s < .2 && (s = Pa(h, r, r + 6) / 4, n = e || Math.atan2(h[r + 7] - h[l - 3], h[r + 6] - h[l - 4])), a = Math.sin(e), o = Math.cos(e), Math.abs(n - e) < Math.PI / 2 && (a = -a, o = -o), h[l] = ((h[r] + o * i) * c | 0) / c, h[1 + l] = ((h[r + 1] + a * i) * c | 0) / c, h[r + 2] = ((h[r] - o * s) * c | 0) / c, h[r + 3] = ((h[r + 1] - a * s) * c | 0) / c, this._updateAnchors(), this.update(), this._saveState())) : G || (this._selectedAnchors.length = 0, this._selectedAnchors.push(t)), B = null, this._updateAnchors()
    }, dt._updateAnchors = function _updateAnchors() {
        var t, e, n, i = 1 === this._selectedAnchors.length ? this._selectedAnchors[0] : null,
            s = i ? i.segment : null;
        for (this._editingAnchor = i, t = 0; t < this._anchors.length; t++) this._anchors[t].element.style.fill = -1 !== this._selectedAnchors.indexOf(this._anchors[t]) ? Q : "white";
        i && (this._handle1.setAttribute("d", i.smooth ? this._circleHandle : this._squareHandle), this._handle2.setAttribute("d", i.smooth ? this._circleHandle : this._squareHandle)), t = i ? i.i : 0, i && (t || i.isClosedStart) ? (e = i.isClosedStart ? s[s.length - 4] : s[t - 2], n = i.isClosedStart ? s[s.length - 3] : s[t - 1], this._handle1.style.visibility = this._line1.style.visibility = X || e !== s[t] || n !== s[t + 1] ? "visible" : "hidden", this._handle1.setAttribute("transform", "translate(" + e + ot + n + ")"), this._line1.setAttribute("points", e + ot + n + ot + s[t] + ot + s[t + 1])) : this._handle1.style.visibility = this._line1.style.visibility = "hidden", i && t < s.length - 2 ? (e = s[t + 2], n = s[t + 3], this._handle2.style.visibility = this._line2.style.visibility = X || e !== s[t] || n !== s[t + 1] ? "visible" : "hidden", this._handle2.setAttribute("transform", "translate(" + e + ot + n + ")"), this._line2.setAttribute("points", s[t] + ot + s[t + 1] + ot + e + ot + n)) : this._handle2.style.visibility = this._line2.style.visibility = "hidden"
    }, dt._onPressAlt = function _onPressAlt() {
        var t = this._editingAnchor;
        t && ((t.i || t.isClosedStart) && (this._handle1.style.visibility = this._line1.style.visibility = "visible"), t.i < t.segment.length - 2 && (this._handle2.style.visibility = this._line2.style.visibility = "visible"))
    }, dt._onReleaseAlt = function _onReleaseAlt() {
        var t, e, n, i = this._editingAnchor;
        i && (t = i.segment, e = i.i, n = i.isClosedStart ? t.length - 4 : e - 2, t[e] === t[n] && t[e + 1] === t[1 + n] && (this._handle1.style.visibility = this._line1.style.visibility = "hidden"), t[e] === t[e + 2] && t[e + 1] === t[e + 3] && (this._handle2.style.visibility = this._line2.style.visibility = "hidden"))
    }, dt._onPressHandle1 = function _onPressHandle1() {
        this._editingAnchor.smooth && (this._oppositeHandleLength = Pa(this._editingAnchor.segment, this._editingAnchor.i, this._editingAnchor.i + 2)), Ga("onPress", this)
    }, dt._onPressHandle2 = function _onPressHandle2() {
        this._editingAnchor.smooth && (this._oppositeHandleLength = Pa(this._editingAnchor.segment, this._editingAnchor.isClosedStart ? this._editingAnchor.segment.length - 4 : this._editingAnchor.i - 2, this._editingAnchor.i)), Ga("onPress", this)
    }, dt._onReleaseHandle = function _onReleaseHandle(t) {
        this._onRelease(t), this._saveState()
    }, dt._onDragHandle1 = function _onDragHandle1() {
        var t, e = this._editingAnchor,
            n = e.segment,
            i = e.i,
            s = e.isClosedStart ? n.length - 4 : i - 2,
            a = 1e3,
            o = this._handle1._draggable.x,
            r = this._handle1._draggable.y;
        n[s] = o = (o * a | 0) / a, n[1 + s] = r = (r * a | 0) / a, e.smooth && (X ? (e.smooth = !1, e.element.setAttribute("d", this._squareHandle), this._handle1.setAttribute("d", this._squareHandle), this._handle2.setAttribute("d", this._squareHandle)) : (t = Math.atan2(n[i + 1] - r, n[i] - o), o = this._oppositeHandleLength * Math.cos(t), r = this._oppositeHandleLength * Math.sin(t), n[i + 2] = ((n[i] + o) * a | 0) / a, n[i + 3] = ((n[i + 1] + r) * a | 0) / a)), this.update()
    }, dt._onDragHandle2 = function _onDragHandle2() {
        var t, e = this._editingAnchor,
            n = e.segment,
            i = e.i,
            s = e.isClosedStart ? n.length - 4 : i - 2,
            a = 1e3,
            o = this._handle2._draggable.x,
            r = this._handle2._draggable.y;
        n[i + 2] = o = (o * a | 0) / a, n[i + 3] = r = (r * a | 0) / a, e.smooth && (X ? (e.smooth = !1, e.element.setAttribute("d", this._squareHandle), this._handle1.setAttribute("d", this._squareHandle), this._handle2.setAttribute("d", this._squareHandle)) : (t = Math.atan2(n[i + 1] - r, n[i] - o), o = this._oppositeHandleLength * Math.cos(t), r = this._oppositeHandleLength * Math.sin(t), n[s] = ((n[i] + o) * a | 0) / a, n[1 + s] = ((n[i + 1] + r) * a | 0) / a)), this.update()
    }, dt._onDragAnchor = function _onDragAnchor(t, e, n) {
        var i, s, a, o, r, h = this._selectedAnchors,
            l = h.length,
            c = 1e3;
        for (s = 0; s < l; s++) i = (o = h[s]).i, a = o.segment, i ? (a[i - 2] = ((a[i - 2] + e) * c | 0) / c, a[i - 1] = ((a[i - 1] + n) * c | 0) / c) : o.isClosedStart && (a[r = a.length - 2] = ta(a[r] + e), a[1 + r] = ta(a[1 + r] + n), a[r - 2] = ta(a[r - 2] + e), a[r - 1] = ta(a[r - 1] + n)), a[i] = ((a[i] + e) * c | 0) / c, a[i + 1] = ((a[i + 1] + n) * c | 0) / c, i < a.length - 2 && (a[i + 2] = ((a[i + 2] + e) * c | 0) / c, a[i + 3] = ((a[i + 3] + n) * c | 0) / c), o !== t && o.element.setAttribute("transform", "translate(" + a[i] + ot + a[i + 1] + ")");
        this.update()
    }, dt.enabled = function enabled(t) {
        if (!arguments.length) return this._enabled;
        for (var e = this._anchors.length; - 1 < --e;) this._anchors[e]._draggable.enabled(t);
        return this._enabled = t, this._handle1._draggable.enabled(t), this._handle2._draggable.enabled(t), this._draggable && this._draggable.enabled(t), t ? this._selection.parentNode || (this.path.ownerSVGElement.appendChild(this._selectionHittest), this.path.ownerSVGElement.appendChild(this._selection), this.init(), this._saveState()) : (this.deselect(), this.path.ownerSVGElement.removeChild(this._selectionHittest), this.path.ownerSVGElement.removeChild(this._selection)), this._updateAnchors(), this.update()
    }, dt.update = function update(t) {
        var e, n, i, s, a, o = "",
            r = this._editingAnchor;
        if (t && this.init(), r && (e = r.i, n = r.segment, (e || r.isClosedStart) && (i = n[a = r.isClosedStart ? n.length - 4 : e - 2], s = n[1 + a], this._handle1.setAttribute("transform", "translate(" + i + ot + s + ")"), this._line1.setAttribute("points", i + ot + s + ot + n[e] + ot + n[e + 1])), e < n.length - 2 && (i = n[e + 2], s = n[e + 3], this._handle2.setAttribute("transform", "translate(" + i + ot + s + ")"), this._line2.setAttribute("points", n[e] + ot + n[e + 1] + ot + i + ot + s))), t) o = this.path.getAttribute("d");
        else {
            for (e = 0; e < this._rawPath.length; e++) 7 < (n = this._rawPath[e]).length && (o += "M" + n[0] + ot + n[1] + "C" + n.slice(2).join(ot));
            this.path.setAttribute("d", o), this._selectionPath.setAttribute("d", o), this._selectionHittest.setAttribute("d", o)
        }
        return this.vars.onUpdate && this._enabled && Ga("onUpdate", this, o), this
    }, dt.getRawPath = function getRawPath(t, e, n) {
        if (t) {
            var i = qa(this.path);
            return transformRawPath(copyRawPath(this._rawPath), 1, 0, 0, 1, i.e + (e || 0), i.f + (n || 0))
        }
        return this._rawPath
    }, dt.getString = function getString(t, e, n) {
        if (t) {
            var i = qa(this.path);
            return function rawPathToString(t) {
                ! function _isNumber(t) {
                    return "number" == typeof t
                }(t[0]) || (t = [t]);
                var e, n, i, s, a = "",
                    r = t.length;
                for (n = 0; n < r; n++) {
                    for (s = t[n], a += "M" + o(s[0]) + "," + o(s[1]) + " C", e = s.length, i = 2; i < e; i++) a += o(s[i++]) + "," + o(s[i++]) + " " + o(s[i++]) + "," + o(s[i++]) + " " + o(s[i++]) + "," + o(s[i]) + " ";
                    s.closed && (a += "z")
                }
                return a
            }(transformRawPath(copyRawPath(this._rawPath), 1, 0, 0, 1, i.e + (e || 0), i.f + (n || 0)))
        }
        return this.path.getAttribute("d")
    }, dt.getNormalizedSVG = function getNormalizedSVG(t, e, n, i) {
        var s, a, o, r, h, l, c = this._rawPath[0],
            d = -1 * c[0],
            u = 0 === e ? 0 : -(e || c[1]),
            g = c.length,
            p = 1 / (c[g - 2] + d),
            f = -t || c[g - 1] + u;
        for (f = f ? 1 / f : -p, p *= 1e3, f *= 1e3, a = at.length = 0; a < g; a += 2) at[a] = ((c[a] + d) * p | 0) / 1e3, at[a + 1] = ((c[a + 1] + u) * f | 0) / 1e3;
        if (i) {
            for (s = [], g = at.length, a = 2; a < g; a += 6) o = at[a - 2], r = at[a - 1], h = at[a + 4], l = at[a + 5], s.push(o, r, h, l), bezierToPoints(o, r, at[a], at[a + 1], at[a + 2], at[a + 3], h, l, .001, s, s.length - 2);
            for (o = s[0], g = s.length, a = 2; a < g; a += 2) {
                if ((h = s[a]) < o || 1 < h || h < 0) {
                    i();
                    break
                }
                o = h
            }
        }
        return n && 8 === g && 0 === at[0] && 0 === at[1] && 1 === at[g - 2] && 1 === at[g - 1] ? at.slice(2, 6).join(",") : (at[2] = "C" + at[2], "M" + at.join(","))
    }, PathEditor);

    function PathEditor(t, e) {
        e = e || {}, Y || function _initCore() {
            L = document, c = window, r = L.body, q = na("div"), (z = na("textarea")).style.display = "none", r && r.appendChild(z), V = function(t) {
                for (var e = t.split(","), n = (void 0 !== q.onpointerdown ? "pointerdown,pointermove,pointerup,pointercancel" : void 0 !== q.onmspointerdown ? "MSPointerDown,MSPointerMove,MSPointerUp,MSPointerCancel" : t).split(","), i = {}, s = 4; - 1 < --s;) i[e[s]] = n[s], i[n[s]] = e[s];
                return i
            }("touchstart,touchmove,touchend,touchcancel"), SVGElement.prototype.getTransformToElement = SVGElement.prototype.getTransformToElement || function(t) {
                return t.getScreenCTM().inverse().multiply(this.getScreenCTM())
            }, L.addEventListener("keydown", function(t) {
                var e, n, i, s, a = t.keyCode || t.which,
                    o = t.key || a;
                if ("Shift" === o || 16 === a) G = !0;
                else if ("Control" === o || 17 === a) l = !0;
                else if ("Meta" === o || 91 === a) d = !0;
                else if ("Alt" === o || 18 === a)
                    for (X = !0, e = rt.length; - 1 < --e;) rt[e]._onPressAlt();
                else if (("z" === o || 90 === a) && (l || d) && 1 < it.length) {
                    if (it.shift(), n = it[0]) {
                        for ((s = n.path).path.setAttribute("d", n.d), s.path.setAttribute("transform", n.transform), s.init(), i = s._anchors, e = 0; e < i.length; e++) - 1 !== n.selectedIndexes.indexOf(i[e].i) && s._selectedAnchors.push(i[e]);
                        s._updateAnchors(), s.update(), s.vars.onUndo && s.vars.onUndo.call(s)
                    }
                } else if ("Delete" === o || "Backspace" === o || 8 === a || 46 === a || 63272 === a || "d" === a && (l || d))
                    for (e = rt.length; - 1 < --e;) rt[e]._deleteSelectedAnchors();
                else if (("a" === o || 65 === a) && (d || l))
                    for (e = rt.length; - 1 < --e;) rt[e].select(!0)
            }, !0), L.addEventListener("keyup", function(t) {
                var e = t.key || t.keyCode || t.which;
                if ("Shift" === e || 16 === e) G = !1;
                else if ("Control" === e || 17 === e) l = !1;
                else if ("Meta" === e || 91 === e) d = !1;
                else if ("Alt" === e || 18 === e) {
                    X = !1;
                    for (var n = rt.length; - 1 < --n;) rt[n]._onReleaseAlt()
                }
            }, !0), h = !!c.PointerEvent, Aa(L, "mouseup", wa), Aa(L, "touchend", wa), Aa(L, "touchcancel", _), Aa(c, "touchmove", _), r && r.addEventListener("touchstart", _), Y = 1
        }(), this.vars = e, this.path = "string" == typeof t ? L.querySelectorAll(t)[0] : t, this._g = oa("g", this.path.ownerSVGElement, {
            class: "path-editor-g path-editor"
        }), this._selectionHittest = oa("path", this._g, {
            stroke: "transparent",
            strokeWidth: 16,
            fill: "none",
            vectorEffect: "non-scaling-stroke"
        }), this._selection = e._selection || oa("g", this._g, {
            class: "path-editor-selection path-editor"
        }), this._selectionPath = oa("path", this._selection, {
            stroke: Q,
            strokeWidth: 2,
            fill: "none",
            vectorEffect: "non-scaling-stroke"
        }), this._selectedAnchors = [], this._line1 = oa("polyline", this._selection, {
            stroke: Q,
            strokeWidth: 2,
            vectorEffect: "non-scaling-stroke"
        }), this._line2 = oa("polyline", this._selection, {
            stroke: Q,
            strokeWidth: 2,
            vectorEffect: "non-scaling-stroke"
        }), this._line1.style.pointerEvents = this._line2.style.pointerEvents = this._selectionPath.style.pointerEvents = "none", this._enabled = !0;
        var n = this.path.parentNode.getScreenCTM().inverse(),
            i = (n.a + n.d) / 2 * (e.handleSize || 5);
        this._squareHandle = function _getSquarePathData(t) {
            return ["M-" + (t = ta(t)), -t, t, -t, t, t, -t, t + "z"].join(ot)
        }(i), this._circleHandle = function _getCirclePathData(t) {
            var e = ta(.552284749831 * t);
            return "M" + (t = ta(t)) + ",0C" + [t, e, e, t, 0, t, -e, t, -t, e, -t, 0, -t, -e, -e, -t, 0, -t, e, -t, t, -e, t, 0].join(ot) + "z"
        }(1.15 * i), this._handle1 = oa("path", this._selection, {
            d: this._squareHandle,
            fill: Q,
            stroke: "transparent",
            strokeWidth: 6
        }), this._handle2 = oa("path", this._selection, {
            d: this._squareHandle,
            fill: Q,
            stroke: "transparent",
            strokeWidth: 6
        }), this._handle1._draggable = new ht(this._handle1, {
            onDrag: this._onDragHandle1,
            callbackScope: this,
            onPress: this._onPressHandle1,
            onRelease: this._onReleaseHandle,
            onClick: this._onClickHandle1,
            snap: e.handleSnap
        }), this._handle2._draggable = new ht(this._handle2, {
            onDrag: this._onDragHandle2,
            callbackScope: this,
            onPress: this._onPressHandle2,
            onRelease: this._onReleaseHandle,
            onClick: this._onClickHandle2,
            snap: e.handleSnap
        }), this._handle1.style.visibility = this._handle2.style.visibility = "hidden";
        for (var s = [this._handle1, this._handle2, this._line1, this._line2, this._selection, this._selectionPath, this._selectionHittest], a = s.length; - 1 < --a;) s[a]._gsSelection = !0;
        !1 !== e.draggable && (this._draggable = new ht(this._selectionHittest, {
            callbackScope: this,
            onPress: this.select,
            onRelease: this._onRelease,
            onDrag: this._onDragPath,
            onDragEnd: this._saveState,
            maxX: this.vars.maxX,
            minX: this.vars.minX
        })), this.init(), this._selection.style.visibility = !1 === e.selected ? "hidden" : "visible", !1 !== e.selected && (this.path._gsSelection = !0, rt.push(this)), this._saveState(), h || (Aa(this._selectionHittest, "mousedown", Fa(this._onClickSelectionPath, this)), Aa(this._selectionHittest, "mouseup", Fa(this._onRelease, this))), Aa(this._selectionHittest, "touchstart", Fa(this._onClickSelectionPath, this)), Aa(this._selectionHittest, "touchend", Fa(this._onRelease, this))
    }
    ut.simplifyPoints = simplifyPoints, ut.pointsToSegment = pointsToSegment, ut.simplifySVG = function(t, e) {
        var n, i, s, a, o, r, h, l, c, d, u, g;
        if (d = (e = e || {}).tolerance || 1, c = e.precision || 1 / d, g = (void 0 === e.cornerThreshold ? 18 : +e.cornerThreshold) * J, "string" != typeof t && (t = (n = t).getAttribute("d")), "#" !== t.charAt(0) && "." !== t.charAt(0) || (n = L.querySelector(t)) && (t = n.getAttribute("d")), i = !1 !== e.curved || /[achqstvz]/gi.test(t) ? stringToRawPath(t)[0] : t.match($), !1 !== e.curved) {
            for (l = i, i = [], u = l.length, s = 2; s < u; s += 6) a = +l[s - 2], r = +l[s - 1], o = +l[s + 4], h = +l[s + 5], i.push(ta(a), ta(r), ta(o), ta(h)), bezierToPoints(a, r, +l[s], +l[s + 1], +l[s + 2], +l[s + 3], o, h, 1 / (2e5 * c), i, i.length - 2);
            (i = pointsToSegment(simplifyPoints(i, d), e.curviness, g))[2] = "C" + i[2]
        } else i = simplifyPoints(i, d);
        return t = "M" + i.join(","), n && n.setAttribute("d", t), t
    }, ut.create = function(t, e) {
        return new ut(t, e)
    }, ut.editingAxis = i, ut.getSnapFunction = function(t) {
        var r = t.radius || 2,
            e = 1e20,
            h = t.x || 0 === t.x ? t.x : t.width ? 0 : -e,
            l = t.y || 0 === t.y ? t.y : t.height ? 0 : -e,
            c = h + (t.width || 1e40),
            d = l + (t.height || 1e40),
            u = !1 !== t.containX,
            g = !1 !== t.containY,
            p = t.axis,
            f = t.gridSize;
        return r *= r,
            function(t) {
                var e, n, i, s, a = t.x,
                    o = t.y;
                u && a < h || (i = a - h) * i < r ? a = h : (u && c < a || (i = c - a) * i < r) && (a = c), g && o < l || (s = o - l) * s < r ? o = l : (g && d < o || (s = d - o) * s < r) && (o = d), p && (i = a - p.x, s = o - p.y, i * i < r && (a = p.x), s * s < r && (o = p.y)), f && (i = (e = h + Math.round((a - h) / f) * f) - a) * i + (s = (n = l + Math.round((o - l) / f) * f) - o) * s < r && (a = e, o = n), t.x = a, t.y = o
            }
    }, ut.version = "3.8.0";

    function bb() {
        return String.fromCharCode.apply(null, arguments)
    }

    function fb(t) {
        return "string" == typeof t
    }

    function gb(t, e) {
        var n = ft.createElementNS ? ft.createElementNS((e || "http://www.w3.org/1999/xhtml").replace(/^https/, "http"), t) : ft.createElement(t);
        return n.style ? n : ft.createElement(t)
    }

    function mb(t, e, n) {
        return fb(t) && St.test(t) ? ft.querySelector(t) : Array.isArray(t) ? yt(vt([{
            x: gt.getProperty(e, "x"),
            y: gt.getProperty(e, "y")
        }].concat(t), n)) : fb(t) || t && "path" === (t.tagName + "").toLowerCase() ? t : 0
    }

    function rb(t, e) {
        var n = "Please gsap.registerPlugin(MotionPathPlugin)";
        pt = window, gt = gt || t || pt.gsap || console.warn(n), ft = document, mt = ft.body, _t = ft.documentElement, (bt = gt && gt.plugins.motionPath) ? (function _initCopyToClipboard() {
            (At = gb("textarea")).style.display = "none", mt.appendChild(At)
        }(), vt = bt.arrayToRawPath, yt = bt.rawPathToString) : !0 === e && console.warn(n)
    }
    var gt, pt, ft, _t, mt, bt, vt, yt, At, Pt = "MotionPathHelper",
        wt = bb(103, 114, 101, 101, 110, 115, 111, 99, 107, 46, 99, 111, 109),
        St = (function(t) {
            var e = 0 === (window ? window.location.href : "").indexOf(bb(102, 105, 108, 101, 58, 47, 47)) || -1 !== t.indexOf(bb(108, 111, 99, 97, 108, 104, 111, 115, 116)) || -1 !== t.indexOf(bb(49, 50, 55, 46, 48, 32, 48, 46, 49)),
                n = [wt, bb(99, 111, 100, 101, 112, 101, 110, 46, 105, 111), bb(99, 111, 100, 101, 112, 101, 110, 46, 112, 108, 117, 109, 98, 105, 110, 103), bb(99, 111, 100, 101, 112, 101, 110, 46, 100, 101, 118), bb(99, 111, 100, 101, 112, 101, 110, 46, 97, 112, 112), bb(112, 101, 110, 115, 46, 99, 108, 111, 117, 100), bb(99, 115, 115, 45, 116, 114, 105, 99, 107, 115, 46, 99, 111, 109), bb(99, 100, 112, 110, 46, 105, 111), bb(112, 101, 110, 115, 46, 105, 111), bb(103, 97, 110, 110, 111, 110, 46, 116, 118), bb(99, 111, 100, 101, 99, 97, 110, 121, 111, 110, 46, 110, 101, 116), bb(116, 104, 101, 109, 101, 102, 111, 114, 101, 115, 116, 46, 110, 101, 116), bb(99, 101, 114, 101, 98, 114, 97, 120, 46, 99, 111, 46, 117, 107), bb(116, 121, 109, 112, 97, 110, 117, 115, 46, 110, 101, 116), bb(116, 119, 101, 101, 110, 109, 97, 120, 46, 99, 111, 109), bb(116, 119, 101, 101, 110, 108, 105, 116, 101, 46, 99, 111, 109), bb(112, 108, 110, 107, 114, 46, 99, 111), bb(104, 111, 116, 106, 97, 114, 46, 99, 111, 109), bb(119, 101, 98, 112, 97, 99, 107, 98, 105, 110, 46, 99, 111, 109), bb(97, 114, 99, 104, 105, 118, 101, 46, 111, 114, 103), bb(99, 111, 100, 101, 115, 97, 110, 100, 98, 111, 120, 46, 105, 111), bb(99, 115, 98, 46, 97, 112, 112), bb(115, 116, 97, 99, 107, 98, 108, 105, 116, 122, 46, 99, 111, 109), bb(99, 111, 100, 105, 101, 114, 46, 105, 111), bb(109, 111, 116, 105, 111, 110, 116, 114, 105, 99, 107, 115, 46, 99, 111, 109), bb(115, 116, 97, 99, 107, 111, 118, 101, 114, 102, 108, 111, 119, 46, 99, 111, 109), bb(115, 116, 97, 99, 107, 101, 120, 99, 104, 97, 110, 103, 101, 46, 99, 111, 109), bb(106, 115, 102, 105, 100, 100, 108, 101, 46, 110, 101, 116)],
                i = n.length;
            for (setTimeout(function() {
                    window && window.console && !window._gsapWarned && gt && !1 !== gt.config().trialWarn && (console.log(bb(37, 99, 87, 97, 114, 110, 105, 110, 103), bb(102, 111, 110, 116, 45, 115, 105, 122, 101, 58, 51, 48, 112, 120, 59, 99, 111, 108, 111, 114, 58, 114, 101, 100, 59)), console.log(bb(65, 32, 116, 114, 105, 97, 108, 32, 118, 101, 114, 115, 105, 111, 110, 32, 111, 102, 32) + Pt + bb(32, 105, 115, 32, 108, 111, 97, 100, 101, 100, 32, 116, 104, 97, 116, 32, 111, 110, 108, 121, 32, 119, 111, 114, 107, 115, 32, 108, 111, 99, 97, 108, 108, 121, 32, 97, 110, 100, 32, 111, 110, 32, 100, 111, 109, 97, 105, 110, 115, 32, 108, 105, 107, 101, 32, 99, 111, 100, 101, 112, 101, 110, 46, 105, 111, 32, 97, 110, 100, 32, 99, 111, 100, 101, 115, 97, 110, 100, 98, 111, 120, 46, 105, 111, 46, 32, 42, 42, 42, 32, 68, 79, 32, 78, 79, 84, 32, 68, 69, 80, 76, 79, 89, 32, 84, 72, 73, 83, 32, 70, 73, 76, 69, 32, 42, 42, 42, 32, 76, 111, 97, 100, 105, 110, 103, 32, 105, 116, 32, 111, 110, 32, 97, 110, 32, 117, 110, 97, 117, 116, 104, 111, 114, 105, 122, 101, 100, 32, 115, 105, 116, 101, 32, 118, 105, 111, 108, 97, 116, 101, 115, 32, 116, 104, 101, 32, 108, 105, 99, 101, 110, 115, 101, 32, 97, 110, 100, 32, 119, 105, 108, 108, 32, 99, 97, 117, 115, 101, 32, 97, 32, 114, 101, 100, 105, 114, 101, 99, 116, 46, 32, 80, 108, 101, 97, 115, 101, 32, 106, 111, 105, 110, 32, 67, 108, 117, 98, 32, 71, 114, 101, 101, 110, 83, 111, 99, 107, 32, 116, 111, 32, 103, 101, 116, 32, 102, 117, 108, 108, 32, 97, 99, 99, 101, 115, 115, 32, 116, 111, 32, 116, 104, 101, 32, 98, 111, 110, 117, 115, 32, 112, 108, 117, 103, 105, 110, 115, 32, 116, 104, 97, 116, 32, 98, 111, 111, 115, 116, 32, 121, 111, 117, 114, 32, 97, 110, 105, 109, 97, 116, 105, 111, 110, 32, 115, 117, 112, 101, 114, 112, 111, 119, 101, 114, 115, 46, 32, 68, 105, 115, 97, 98, 108, 101, 32, 116, 104, 105, 115, 32, 119, 97, 114, 110, 105, 110, 103, 32, 119, 105, 116, 104, 32, 103, 115, 97, 112, 46, 99, 111, 110, 102, 105, 103, 40, 123, 116, 114, 105, 97, 108, 87, 97, 114, 110, 58, 32, 102, 97, 108, 115, 101, 125, 41, 59)), console.log(bb(37, 99, 71, 101, 116, 32, 117, 110, 114, 101, 115, 116, 114, 105, 99, 116, 101, 100, 32, 102, 105, 108, 101, 115, 32, 97, 116, 32, 104, 116, 116, 112, 115, 58, 47, 47, 103, 114, 101, 101, 110, 115, 111, 99, 107, 46, 99, 111, 109, 47, 99, 108, 117, 98), bb(102, 111, 110, 116, 45, 115, 105, 122, 101, 58, 49, 54, 112, 120, 59, 99, 111, 108, 111, 114, 58, 35, 52, 101, 57, 56, 49, 53)), window._gsapWarned = 1)
                }, 50); - 1 < --i;)
                if (-1 !== t.indexOf(n[i])) return;
            e
        }(window ? window.location.host : ""), /(^[#\.][a-z]|[a-y][a-z])/i),
        Ct = {
            matrix: {
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: 0,
                f: 0
            }
        },
        xt = (MotionPathHelper.prototype.getString = function getString() {
            return this.editor.getString(!0, -this.offset.x, -this.offset.y)
        }, MotionPathHelper);

    function MotionPathHelper(t, e) {
        void 0 === e && (e = {}), bt || rb(e.gsap, 1);
        var n, i, s, a, o, r, h, l, c, d, u, g, p, f = gb("div"),
            _ = this,
            m = {
                x: 0,
                y: 0
            };
        t instanceof gt.core.Tween ? n = (l = t).targets()[0] : (n = gt.utils.toArray(t)[0], l = function _findMotionPathTween(t) {
                for (var e = gt.getTweensOf(t), n = 0; n < e.length; n++) {
                    if (e[n].vars.motionPath) return e[n];
                    e[n].timeline && e.push.apply(e, e[n].timeline.getChildren())
                }
            }(n)), i = mb(e.path, n, e), this.offset = m, r = function _getPositionOnPage(t) {
                var e = t.getBoundingClientRect(),
                    n = _t.clientTop - (pt.pageYOffset || _t.scrollTop || mt.scrollTop || 0),
                    i = _t.clientLeft - (pt.pageXOffset || _t.scrollLeft || mt.scrollLeft || 0);
                return {
                    left: e.left + i,
                    top: e.top + n,
                    right: e.right + i,
                    bottom: e.bottom + n
                }
            }(n), a = parseFloat(gt.getProperty(n, "x", "px")), o = parseFloat(gt.getProperty(n, "y", "px")), s = n.getCTM && "svg" !== n.tagName.toLowerCase(), l && !i && (i = mb(l.vars.motionPath.path || l.vars.motionPath, n, l.vars.motionPath)), f.setAttribute("class", "copy-motion-path"), f.style.cssText = "border-radius:8px; background-color:rgba(85, 85, 85, 0.7); color:#fff; cursor:pointer; padding:6px 12px; font-family:Signika Negative, Arial, sans-serif; position:fixed; left:50%; transform:translate(-50%, 0); font-size:19px; bottom:10px", f.innerText = "COPY MOTION PATH", f._gsHelper = _, (gt.utils.toArray(e.container)[0] || mt).appendChild(f),
            function _addCopyToClipboard(n, i, s) {
                n.addEventListener("click", function(t) {
                    if (t.target._gsHelper) {
                        var e = i(t.target);
                        if ((At.value = e) && At.select) {
                            console.log(e), At.style.display = "block", At.select();
                            try {
                                ft.execCommand("copy"), At.blur(), s && s(n)
                            } catch (t) {
                                console.warn("Copy didn't work; this browser doesn't permit that.")
                            }
                            At.style.display = "none"
                        }
                    }
                })
            }(f, function() {
                return _.getString()
            }, function() {
                return gt.fromTo(f, {
                    backgroundColor: "white"
                }, {
                    duration: .5,
                    backgroundColor: "rgba(85, 85, 85, 0.6)"
                })
            }), (h = i && i.ownerSVGElement) || (c = s && n.ownerSVGElement && n.ownerSVGElement.getAttribute("xmlns") || "http://www.w3.org/2000/svg", s ? (h = n.ownerSVGElement, d = n.getBBox(), a = (u = function _getConsolidatedMatrix(t) {
                return (t.transform.baseVal.consolidate() || Ct).matrix
            }(n)).e, o = u.f, m.x = d.x, m.y = d.y) : (h = gb("svg", c), mt.appendChild(h), h.setAttribute("viewBox", "0 0 100 100"), h.style.cssText = "overflow:visible; background-color: transparent; position:absolute; width:100px; height:100px; top:" + (r.top - o) + "px; left:" + (r.left - a) + "px;"), d = fb(i) && !St.test(i) ? i : function _getInitialPath(t, e) {
                var n, i = [0, 31, 8, 58, 24, 75, 40, 90, 69, 100, 100, 100];
                for (n = 0; n < i.length; n += 2) i[n] += t, i[n + 1] += e;
                return "M" + t + "," + e + "C" + i.join(",")
            }(a, o), (i = gb("path", c)).setAttribute("d", d), i.setAttribute("vector-effect", "non-scaling-stroke"), i.style.cssText = "fill:transparent; stroke-width:" + (e.pathWidth || 3) + "; stroke:" + (e.pathColor || "#555") + "; opacity:" + (e.pathOpacity || .6), h.appendChild(i), (m.x || m.y) && gt.set(i, {
                x: m.x,
                y: m.y
            })), "selected" in e || (e.selected = !0), "anchorSnap" in e || (e.anchorSnap = function(t) {
                t.x * t.x + t.y * t.y < 16 && (t.x = t.y = 0)
            }), p = l && "nested" === l.parent.data ? l.parent.parent : l, e.onPress = function() {
                p.pause(0)
            }, g = function refreshPath() {
                l.invalidate(), p.restart()
            }, e.onRelease = e.onDeleteAnchor = g, this.editor = ut.create(i, e), e.center && gt.set(n, {
                transformOrigin: "50% 50%",
                xPercent: -50,
                yPercent: -50
            }), l ? (l.vars.motionPath.path ? l.vars.motionPath.path = i : l.vars.motionPath = {
                path: i
            }, p.parent !== gt.globalTimeline && gt.globalTimeline.add(p, function _getGlobalTime(t) {
                for (var e = t.totalTime(); t;) e = t.startTime() + e / (t.timeScale() || 1), t = t.parent;
                return e
            }(p) - p.delay()), p.repeat(-1).repeatDelay(1)) : l = p = gt.to(n, {
                motionPath: {
                    path: i,
                    start: e.start || 0,
                    end: "end" in e ? e.end : 1,
                    autoRotate: "autoRotate" in e && e.autoRotate,
                    align: i,
                    alignOrigin: e.alignOrigin
                },
                duration: e.duration || 5,
                ease: e.ease || "power1.inOut",
                repeat: -1,
                repeatDelay: 1,
                paused: !e.path
            }), this.animation = l
    }
    xt.register = rb, xt.create = function(t, e) {
        return new xt(t, e)
    }, xt.editPath = function(t, e) {
        return ut.create(t, e)
    }, xt.version = "3.8.0", t.MotionPathHelper = xt, t.default = xt;
    if (typeof(window) === "undefined" || window !== t) {
        Object.defineProperty(t, "__esModule", {
            value: !0
        })
    } else {
        delete t.default
    }
});