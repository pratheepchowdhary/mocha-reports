var chai = require('chai');
var assert = require('assert');
var should = chai.should();

describe("Bug test", () => {
    var request = require('superagent')
        .agent();

    it("request initialized", done => {
        request.should.be.ok;
        done();
    });

    it("can get /test page", done => {
        var req = request.get('https://www.google.com');
        assert.equal(2,3,"Verify both are equal")
        assert.equal(2,4,"Verify both are equal");
        assert.equal(2,2,"Verify both are equal");
       

        req
            .end((err, res) => {
                if (err) {
                    done(err);
                    return;
                }

                res.ok.should.be.ok;
                res.type.should.match(/application\/json/);
                res.body.NODE_ENV.should.be.oneOf(['development', 'production'])
                should.exist(res.headers.date)
                should.not.exist(res.headers.cookies);
                done();
            })
    });
});
