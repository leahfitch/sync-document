var jsondiffpatch = require('jsondiffpatch'),
    diff = jsondiffpatch.diff,
    patch = jsondiffpatch.patch,
    copy = function (obj)
    {
        var new_obj = {}
        Object.keys(obj).forEach(function (k)
        {
            new_obj[k] = obj[k]
        })
        return new_obj
    }


module.exports = SyncDocument


function SyncDocument (object)
{
    /* The canonical version of our object. Edit this. */
    this.object = object
    
    /* A shadow that maintains sync with our buddy's shadow. */
    this.shadow = {
        version: 0,
        other_version: 0,
        object: copy(object)
    }
    
    /* A backup of the shadow we can use to rollback if updates
    are dropped by our buddy */
    this.backup = {
        version: 0,
        object: copy(object)
    }
    
    /* A stack of our edits that have not been confirmed by our buddy. */
    this.edits = []
    
    /* Number of times this document is being referenced */
    this.references = 1
}


SyncDocument.prototype.push = function ()
{
    /* First let's try to create a delta against our shadow */
    var delta = diff(this.shadow.object, this.object)
    
    /* If there aren't any changes, we're done. */
    if (!delta)
    {
        return
    }
    
    /* An edit is a delta along with some version information for housekeeping. */
    var edit = {
        version: this.shadow.version,
        other_version: this.shadow.other_version,
        delta: delta
    }
    
    /* First back up our shadow */
    this.backup.object = this.shadow.object
    this.backup.version = this.shadow.version
    
    /*  Then copy the latest version to the shadow and increment the shadow's version */
    this.shadow.object = copy(this.object)
    this.shadow.version++
    
    /* Then send the edit to our buddy to be applied to its shadow. */
    this.edits.push(edit)
}

SyncDocument.prototype.pull = function (edit)
{
    /* The edit comes from our buddy. The edit's version is the base version
    of our buddy's diff (our "other_version"). */
    
    /* If there are no changes, we are dealing with an acknowledgement of the
    last version received by our buddy */
    if (!edit.delta)
    {
        this.acknowledge(edit.other_version)
        return
    }
    
    /* If the edit version is older than the version we last got from our buddy it 
    means we already saw this edit and most likely our acknowledgement was dropped.
    We don't need to do anything about this. */
    if (edit.version < this.shadow.other_version)
    {
        return
    }
    
    /*
    If the last version of us our buddy got doesn't match our current version
    it means our buddy missed some of our edits. We need to rollback.
    */
    if (edit.other_version != this.shadow.version)
    {
        this.rollback()
        return
    }
    
    /* If all the version numbers match up we can patch our shadow and then 
    attempt to patch our canonical version */
    this.shadow.object = patch(this.shadow.object, edit.delta)
    this.shadow.other_version = edit.version + 1
    
    /* If our canonical version is just too different, we can skip this patch and send out the
    delta between our canonical version and patched shadow effectively clobbering this edit
    on our buddy's end */
    try
    {
        this.object = patch(this.object, edit.delta)
    }
    catch (e)
    {
        this.push()
    }
    
    this.acknowledge(edit.other_version)
}

SyncDocument.prototype.acknowledge = function (version)
{
    /* Remove any edits in our edit stack that are against the last version our buddy 
    has just confirmed so that they aren't resent */
    this.edits = this.edits.filter(function (e)
    {
        return version < e.version
    })
}

SyncDocument.prototype.rollback = function (edit)
{
    /* Clear all outgoing edits since they are based on a version we are clobbering */
    this.edits = []
    
    /* Restore the shadow from the backup */
    this.shadow.object = copy(this.backup.object)
    this.shadow.version = this.backup.version
    
    /* Apply the edit per usual */
    this.pull(edit)
}

SyncDocument.prototype.receipt = function ()
{
    return this.shadow.other_version
}