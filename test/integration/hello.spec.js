/*global describe, it, before, after*/
import {startServer, close} from "../../src/server.js";
import * as chai from 'chai';
import fetch from "node-fetch";

let expect = chai.expect;

describe('Integration Tests for hello api', function () {

    before(async function () {
        await startServer();
    });

    after(async function () {
        await close();
    });

    it('should say hello without auth', async function () {
        let output = await fetch("http://localhost:5000/hello?name=world", { method: 'GET'});
        output = await output.json();
        expect(output).eql({message: "hello world"});
    });

    it('should say helloAuth if authorised', async function () {
        let output = await fetch("http://localhost:5000/helloAuth?name=world", { method: 'GET', headers: {
            authorization: "Basic hehe"
        }});
        output = await output.json();
        expect(output).eql({message: "hello world"});
    });

    it('should not say helloAuth if unauthorised', async function () {
        let output = await fetch("http://localhost:5000/helloAuth?name=world", { method: 'GET'});
        output = await output.json();
        expect(output).eql({
            "error": "Unauthorized",
            "message": "Wrong key",
            "statusCode": 401});
    });
});
