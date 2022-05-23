'use strict'
const fs = require('fs')
const {parse} = require('csv-parse')
const {uniq, cloneDeep} = require('lodash')

const {INPUT, OUTPUT} = {INPUT:'input.csv', OUTPUT:'output.json'}

class Csv2Json{
  constructor(dataframe) {
    this.transposeDataframe = this.getTransDf(dataframe)
    const {mapIndex, template} = this.mapIndexTemplate(
        cloneDeep(this.transposeDataframe.find(e=>e[0]==='eid'))
      )
    this.mapIndex = mapIndex
    this.result = this.transposeDataframe.reduce(
        (accumulator, element)=>this.parser(accumulator, element), 
        template
      )
  }

  getTransDf(dataframe) {
    return Object.keys(dataframe[0]).map((column) => {
        return dataframe.map((row) => row[column]);
    });
  }

  mapIndexTemplate(eids) {
    eids.shift()
    const defaultObj = {
      fullname: null,
      eid: null,
      groups:[], 
      addresses:[],
      invisible:null,
      see_all:null
    }
    let mapIndex = {0:0}
    let countUnique = 0
    let template = [cloneDeep(defaultObj)]
    for(let i=1; i<eids.length; i++){
      if(eids[i] !== eids[i-1]) {
        countUnique++
        template.push(cloneDeep(defaultObj))
      }
      mapIndex[i] = countUnique
    }
    return {mapIndex, template}
  }

  addressParser(tags, column) {
    const type = tags.shift()

    const handler = {
      phone:(field) => {
        const num = `55${field.replace(/\D/gi, '')}`
        return [{
          tags,
          type,
          address: num.length === 13 ? num : null
        }]
      },
      email:(field) => {
        return field.replace(/\s+\W*$/, '').split('/').map(addr=>({
          tags,
          type,
          address: addr.match(/[\w.-]+@[\w.-]+\.\w+/gi) ? addr : null
        }))
      }
    }[type]

    const result = column.map(handler)
    return result
  }

  parser(accumulator, element) {
    const header = element.shift()
    switch(header){
      case 'fullname':
        element.forEach((field, index)=>{
          accumulator[this.mapIndex[index]].fullname = field
        })
      break
      case 'eid':
        element.forEach((field, index)=>{
          accumulator[this.mapIndex[index]].eid = field
        })
      break
      case 'invisible':
        element.forEach((field, index)=>{
          accumulator[this.mapIndex[index]].invisible = ['1', 'yes'].includes(field)
        })
      break
      case 'see_all':
        element.forEach((field, index)=>{
          accumulator[this.mapIndex[index]].see_all = ['1', 'yes'].includes(field)
        })
      break
      case 'group':
        element.forEach((field, index)=>{
          let groups = field.replace(/(^\s*|\s*$)/, '').split(/\s*[,\/]\s*/)
          if(groups[0])
            accumulator[this.mapIndex[index]].groups = uniq([...accumulator[this.mapIndex[index]].groups, ...groups]).sort()
        })
      break
      default:
        this.addressParser(header.split(' '), element).forEach((field, index)=>{
          field = field.filter(e=>e.address)
          accumulator[this.mapIndex[index]].addresses = [...accumulator[this.mapIndex[index]].addresses, ...field]
        })
      break
    }
    return accumulator
  }

  build(outputPath) {
    fs.writeFileSync( outputPath, JSON.stringify(this.result, null, 2) )
  }
}

const csvData=[];
fs.createReadStream(INPUT)
  .pipe(parse())
  .on('data', (csvrow)=>{
      csvData.push(csvrow);        
  })
  .on('end',()=>{
    const parser = new Csv2Json(csvData)
    parser.build(OUTPUT)
  });