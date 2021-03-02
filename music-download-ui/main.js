const apiBaseUrl = 'https://zencode.top:9001'

Vue.prototype.$vant = vant
const VM = new Vue({
  el: '#root',
  data: {
    searchText: '',
    list: [],
    activeNames: [0, 1, 2],
    loading: false,
    loadingMusicUrl: false,
    loadingMusicUrlTag: false,
  },
  mounted() {
    // this.onSearch()
  },
  methods: {
    onSearch() {
      const sText = this.searchText

      this.loading = true

      axios.get(apiBaseUrl + '/search?keywords=' + sText, {
        withCredentials: true
      }).then(res => {
        const data = res.data.result
        // console.log(JSON.parse(JSON.stringify(data.songs)))
        this.list = data.songs

      }).catch(err => {
        console.error(err)
        this.list = []
        this.$vant.Toast(err.message)
      }).finally(() => {
        this.loading = false
      })
    },
    convertMinSec(ms) {
      const time = (ms / 1000 / 60).toString().split('.') // 分钟拆分成整数和小数

      return time[0] + ':' + (time[1] * 60).toString().substring(0, 2)
    },
    formatArtist(arr, separator = ' / ') {
      var nameArr = []
      arr.forEach(v => {
        nameArr.push(v.name)
      })

      return nameArr.join(separator)
    },
    async getMusicUrl(music, direct = false) {
      const id = music.id

      try {
        this.loadingMusicUrl = id
        const musicAvailableRes = await axios.get(apiBaseUrl + '/check/music?id=' + id)
        const requestLinkUrl = direct ?
          '/song/url?id=' + id :  // 最高音质，可能是 FLAC
          '/song/url?br=320000&id=' + id // 最高320kbps MP3
        const musicUrlRes = await axios.get(apiBaseUrl + requestLinkUrl)

        const available = musicAvailableRes.data
        const musicUrl = musicUrlRes.data.data[0]
        console.log({
          available,
          musicUrl
        })

        if (!available.success) {
          this.$vant.Toast(available.message)
          throw new Error(available.message)
        }
        if (!musicUrl.url) {
          this.$vant.Toast('版权限制，无法下载')
          throw new Error('版权限制')
        }

        // 直接打开
        if (direct) {
          window.open(musicUrl.url)
          return
        }

        this.downloadMusic(musicUrl.url, music)

      } catch (err) {
        console.error(err)
        this.$vant.Toast(err.message)
      } finally {
        this.loadingMusicUrl = false
      }
    },
    /**
     * 填充ID3标签，并下载音乐
     */
    async downloadMusic(url, music) {
      const id = music.id
      const saveFileName = this.formatArtist(music.artists, ', ')
        + ' - ' + music.name + '.mp3'

      try {
        this.loadingMusicUrlTag = id

        const musicDetail = await axios.get(apiBaseUrl + '/song/detail?ids=' + id)
        const detail = musicDetail.data.songs[0]
        console.log(detail)

        const musicRes = await axios.get(url, {
          responseType: 'arraybuffer'
        })
        const arrayBuffer = musicRes.data

        const writer = new ID3Writer(arrayBuffer);
        writer.setFrame('TIT2', detail.name)  // song title
          .setFrame('TPE1', this.formatArtist(music.artists, ';').split(';')) // song artists
          .setFrame('TALB', detail.al.name) // album title
          .setFrame('TYER', new Date(detail.publishTime).getFullYear()) // album release year
          .setFrame('TRCK', detail.no)   // song number in album
          .setFrame('TPOS', detail.cd)   // album disc number
          .setFrame('TCON', [])   // song genres

        if (detail.al.picUrl) {
          // 获取封面图
          const coverRes = await axios.get(detail.al.picUrl, {
            responseType: 'arraybuffer'
          })
          const coverArrayBuffer = coverRes.data
          writer.setFrame('APIC', {
            type: 3,
            data: coverArrayBuffer,
            description: ''
          })  // attached picture
        }

        writer.addTag();

        // const taggedSongBuffer = writer.arrayBuffer;
        const blob = writer.getBlob();
        // const newUrl = writer.getURL();

        saveAs(blob, saveFileName)
      } catch (err) {
        console.error(err)
        this.$vant.Toast(err.message)
      } finally {
        this.loadingMusicUrlTag = false
      }
    }
  }
})
