import { generateSQL } from "./common"
import { Materialize } from "./materialize.min.js"

/**
 * bookmark table:
 * [id, name, url]
 * tag table:
 * [id, bid, name]
 * memo table:
 * [id, bid, value]
 * bookmark.id --+-- tag.bid
 *               |
 *               +-- memo.bid
 *
 * create table if not exists bookmark(id integer primary key autoincrement, name text, url text);
 * create table if not exists tag     (id integer primary key autoincrement, bid integer, name text);
 * create table if not exists memo    (id integer primary key autoincrement, bid integer, value text);
 * */
const dfds = []
$(function () {
  db_query(
    "create table if not exists bookmark(id integer primary key autoincrement, name text unique, url text unique);"
  )
  db_query(
    "create table if not exists tag     (id integer primary key autoincrement, bid integer, name text);"
  )
  db_query(
    "create table if not exists memo    (id integer primary key autoincrement, bid integer, value text);"
  )

  $("#exec").click(function () {
    $("#f-search").submit()
  })

  $("#add").click(add_bookmark)

  $("#f-search").bind("submit keyup", function (e) {
    e.preventDefault()
    const text = $("#search").val()
    if (text === "") {
      return true
    }
    search_bookmark(text)
  })

  $("#opt_apply").click(function () {
    const id = $("#opt_apply").data("id")
    db_query(
      "update bookmark " +
        ' set name = "' +
        $("#opt_name").val() +
        '", url = "' +
        $("#opt_url").val() +
        '" where id = ' +
        id
    )
    db_query("delete from tag where bid = " + id)
    const tags = $("#opt_tags").val().split(",")
    for (let i = 0; i < tags.length; i++) {
      if (tags[i] == "") continue
      db_query(
        "insert into tag(bid, name) values(" + id + ', "' + tags[i] + '");'
      )
    }
    get_tags(id)

    $("#option_modal").closeModal()
  })

  $("#opt_cancel").click(function () {
    $("#option_modal").closeModal()
  })

  $("#opt_remove").click(function () {
    if (confirm("Are you sure?")) {
      const id = $("#opt_apply").data("id")
      db_query("delete from bookmark where id = " + id)
    }
    $("#option_modal").closeModal()
    $("#f-search").submit()
  })

  db_query("select * from tag group by name").done(function (r) {
    r.forEach(function (item) {
      $("#tags-select").append($("<option>").val(item.name).text(item.name))
    })
  })
  $("#tags-select").change(function () {
    $("#search").val(
      $("#search").val() +
        ($("#search").val().length < 1 ? "" : " ") +
        "#" +
        $(this).val()
    )
    $(this).val(0)
    $("#f-search").keyup()
    return false
  })
})

function db_query(sql) {
  const dfd = jQuery.Deferred()
  chrome.runtime.sendMessage({ action: "sql", sql: sql }, function (r) {
    dfds[r.id] = dfd
  })
  return dfd.promise()
}

function search_bookmark(text) {
  const sql = generateSQL(text)
  $("#result").empty()

  db_query(sql).done(function (r) {
    let res =
      '<li class="collection-header"><h6>' + r.length + " results</h6></li>"
    r.forEach(function (item) {
      res +=
        '<li class="black-text collection-item"><span class="title result-title"><a href="' +
        item.url +
        '" target="_blank" class="tooltipped" data-tooltip="' +
        item.url +
        '">' +
        item.name +
        '</a></span><a href="#" class="option-link secondary-content" data-id="' +
        item.id +
        '"><i class="material-icons">settings</i></a><div style="clear: both" class="badge tags" data-id="' +
        item.id +
        '"></div></li>'
      get_tags(item.id)
    })
    $("#result").html(res)
    $(".tooltipped").tooltip({ delay: 10 })
    $(".option-link").click(function () {
      const id = $(this).data("id")
      $("#opt_apply").data("id", id)
      db_query("select * from bookmark where id = " + id)
        .then(function (r) {
          $("#opt_url").val(r[0].url)
          $("#opt_name").val(r[0].name)

          return db_query("select id, bid, name from tag where bid = " + id)
        })
        .done(function (r) {
          $("#opt_tags").val(
            r
              .map(function (d) {
                return d.name
              })
              .join(",")
          )

          $("#option_modal").openModal()
          Materialize.updateTextFields()
        })
    })
  })
  return false
}

function get_tags(id) {
  db_query("select * from tag where bid = " + id).done(function (r2) {
    $(".tags[data-id='" + id + "']").empty()
    r2.forEach(function (item2) {
      $(".tags[data-id='" + id + "']").append(
        '<div class="chip">' + item2.name + "</div>"
      )
    })
  })
}

function add_bookmark() {
  if (confirm("Are you sure?")) {
    chrome.tabs.getSelected(null, function (tab) {
      chrome.runtime.sendMessage({
        action: "add",
        title: tab["title"],
        url: tab["url"],
      })
    })
  }
}

chrome.runtime.onMessage.addListener(function (req) {
  switch (req.action) {
    case "resolve":
      dfds[req.id].resolve(req.data)
      break
    default:
      break
  }
})
