/*global $*/
/*global io*/

Date.prototype.yyyymmdd = function() {
 var yyyy = this.getFullYear().toString();
 var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
 var dd  = this.getDate().toString();
 var hh = this.getHours().toString();
 var MM = this.getMinutes().toString();
 var ss = this.getSeconds().toString();
 return yyyy + "-" + (mm[1]?mm:"0"+mm[0])+ "-" + (dd[1]?dd:"0"+dd[0]) + " " +
  (hh[1]?hh:"0"+hh[0]) + ":" + (MM[1]?MM:"0"+MM[0]) + ":" + (ss[1]?ss:"0"+ss[0]); // padding
};

var t = $('#tasks').DataTable( {
  "order": [[ 3, "desc" ]],
  "columns": [
    { "width": "20%" },
    { "width": "50%" },
    { "width": "10%" },
    { "width": "10%" },
    { "width": "10%" }
  ]
});

var socket = io(); // TIP: io() with no args does auto-discovery

var password = "";

socket.emit('getAllTasks');

$("#formTask").on("submit", function(e){
    e.preventDefault();
    if ($("#inpTask").val() != null && $("#inpTask").val() != ""){
        socket.emit('task', {task: $("#inpTask").val(), feature: $("#inpFeature").val()});
    }
    $("#inpTask").val("");
});

function addTask(task){
    t.row.add([
      task.feature ? feature[task.feature] : "None",
      task.task,
      state[task.state],
      new Date(task.dateCreation).yyyymmdd(),
      'None <button type="button" class="btn btn-default btn-xs" aria-label="Left Align"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></button>'
    ]).draw(false);
    $("#taskCounter").html((parseInt($("#taskCounter").html()) + 1).toString());
}

function removeTask(id){
    socket.emit('deleteTask', id);
}

socket.on('task', function(task){
    addTask(task);
});

socket.on('taskFeatures', function(taskFeatures){
    for (var i=0; i<taskFeatures.length; i++){
      var taskFeature = taskFeatures[i];
      feature[taskFeature.id] = taskFeature.name;
      $("#inpFeature").html($("#inpFeature").html()+"<option value="+taskFeature.id+">"+taskFeature.name+"</option>");
    }
});

socket.on('taskStates', function(taskStates){
    for (var i=0; i<taskStates.length; i++){
      var taskState = taskStates[i];
      state[taskState.id] = taskState.name;
    }
});

socket.on('deleteTask', function(taskId){
    $("#ulTasks").children("#task_"+taskId).remove();
});

socket.on('allTasks', function(tasks){
    $('#ulTasks').empty();
    for (var i=0; i<tasks.length; i++){
        addTask(tasks[i]);
    }
});
