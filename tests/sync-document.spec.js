var SyncDocument = require('../lib')

describe("SyncDocument", function ()
{
	it("is initialized with an object", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		expect(doc.object).to.deep.equal({ foo: 123 })
	})
	
	it("has a shadow with a copy of the initial object", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		expect(doc.shadow.object).to.not.equal(doc.object)
		expect(doc.shadow.object).to.deep.equal(doc.object)
	})
	
	it("has a shadow that has its own version and the last seen buddy version, both initialized with 0", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		expect(doc.shadow.version).to.equal(0)
		expect(doc.shadow.other_version).to.equal(0)
	})
	
	it("has a backup with a copy of the initial object", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		expect(doc.backup.object).to.not.equal(doc.object)
		expect(doc.backup.object).to.deep.equal(doc.object)
		expect(doc.backup.version).to.equal(0)
	})
	
	it("has a backup with a version number of 0", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		expect(doc.backup.version).to.equal(0)
	})
	
	it("has an initially empty stack of edits", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		expect(doc.edits)
	})
	
	it("has a push() method that pushes changes between the object and its shadow on the edit stack", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		doc.object.foo = 5
		doc.push()
		expect(doc.edits.length).to.equal(1)
		expect(doc.edits[0]).to.deep.equal({ version: 0, other_version: 0, delta: { foo: [ 123, 5 ] } })
	})
	
	it("copies the object onto the shadow an updates the shadow version when pushing", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		doc.object.foo = 5
		expect(doc.shadow.object).not.to.deep.equal(doc.object)
		doc.push()
		expect(doc.shadow.object).to.deep.equal(doc.object)
		expect(doc.shadow.version).to.equal(1)
		expect(doc.shadow.other_version).to.equal(0)
	})
	
	it("creates a backup of the old shadow when pushing", function ()
	{
		var doc = new SyncDocument({ foo: 123 }),
			old_shadow = {
				object: doc.shadow.object,
				version: doc.shadow.version
			}
		
		doc.object.foo = 5
		doc.push()
		expect(doc.backup.object).to.equal(old_shadow.object)
		expect(doc.backup.version).to.equal(old_shadow.version)
	})
	
	it("does nothing when pushing if there are no changes", function ()
	{
		var doc = new SyncDocument({ foo: 123 })
		doc.push()
		expect(doc.object).to.deep.equal({ foo: 123 })
		expect(doc.shadow.object).to.deep.equal(doc.object)
		expect(doc.shadow.version).to.equal(0)
		expect(doc.shadow.other_version).to.equal(0)
	})
	
	it("has a pull() method that applies an edit to the shadow and base object", function ()
	{
		var a = new SyncDocument({ foo: 123 }),
			b = new SyncDocument({ foo: 123 })
		
		a.object.bar = 5
		a.push()
		b.pull(a.edits[0])
		
		expect(b.object).to.deep.equal({ foo: 123, bar: 5 })
		expect(b.shadow.object).to.deep.equal({ foo: 123, bar: 5 })
		expect(b.shadow.version).to.equal(0)
		expect(b.shadow.other_version).to.equal(1)
	})
	
	it("calls acknowledge() if the edit passed to pull() has no delta", function ()
	{
		var bar = new SyncDocument({ foo: 123 })
		bar.acknowledge = sinon.stub()
		bar.pull({ other_version: 55 })
		expect(bar.acknowledge).to.have.been.calledWith(55)
	})
	
	it("doesn't do anything when pulling if the edit's version is old", function ()
	{
		var bar = new SyncDocument({ foo: 123 })
		bar.shadow.version = 2
		bar.pull({ version: 1 })
		
		expect(bar.shadow.version).to.equal(2)
		expect(bar.shadow.other_version).to.equal(0)
		expect(bar.shadow.object).to.deep.equal({ foo: 123 })
	})
	
	it("rolls back when attempting to pull an edit with a version mismatch", function ()
	{
		var bar = new SyncDocument({ foo: 123 })
		bar.rollback = sinon.stub()
		bar.shadow.version = 1
		bar.pull({ other_version: 0, delta: [] })
		expect(bar.rollback).to.have.been.calledOnce
	})
})
